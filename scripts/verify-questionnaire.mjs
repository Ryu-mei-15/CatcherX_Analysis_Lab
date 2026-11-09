import fs from 'node:fs';
import vm from 'node:vm';

const backendPath = new URL('../events/ec-special-issue/backend/apps-script/Code.gs', import.meta.url);
const source = fs.readFileSync(backendPath, 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'Code.gs' });

const validPayload = {
  responseId: '11111111-2222-4333-8444-555555555555',
  tlxRatings: {
    mental: 50,
    physical: 50,
    temporal: 50,
    performance: 50,
    effort: 50,
    frustration: 50
  },
  operationRatings: {
    directionReflection: { status: 'answered', value: 7 },
    unintendedDirection: { status: 'answered', value: 2 },
    catchToTransfer: { status: 'answered', value: 6 },
    transferToThrow: { status: 'not_experienced', value: null }
  },
  difficultyComment: '',
  susResponses: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
};

const result = context.validatePostTaskPayload_(validPayload);
if (result.tlxScore !== 50) throw new Error(`Unexpected TLX score: ${result.tlxScore}`);
if (result.susScore !== 50) throw new Error(`Unexpected SUS score: ${result.susScore}`);
if (result.operationRatings.transferToThrow.status !== 'not_experienced') {
  throw new Error('not_experienced was not preserved');
}

const expectFailure = (mutate, label) => {
  const copy = structuredClone(validPayload);
  mutate(copy);
  try {
    context.validatePostTaskPayload_(copy);
    throw new Error(`${label} unexpectedly passed`);
  } catch (error) {
    if (error.message === `${label} unexpectedly passed`) throw error;
  }
};

expectFailure(payload => { delete payload.tlxRatings.mental; }, 'missing TLX');
expectFailure(payload => { payload.tlxRatings.performance = 52; }, 'invalid TLX increment');
expectFailure(payload => { delete payload.operationRatings.catchToTransfer; }, 'missing operation rating');
expectFailure(payload => { payload.operationRatings.transferToThrow.value = 4; }, 'invalid not_experienced value');
expectFailure(payload => { payload.susResponses.pop(); }, 'missing SUS');
expectFailure(payload => { payload.difficultyComment = 'a'.repeat(2001); }, 'oversized comment');

const profile = context.validateProfilePayload_({
  baseballExperience: 'yes', baseballYears: 8,
  catcherExperience: 'yes', catcherYears: 3,
  competitionHistory: '学校部活動', recentPlayStatus: '現在もプレイ',
  vrHmdExperience: 'no', dominantHand: 'right'
});
if (profile.catcherYears !== 3) throw new Error('Profile validation failed');

console.log('questionnaire validators: OK');
