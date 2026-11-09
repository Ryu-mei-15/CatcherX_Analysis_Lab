const CATCHERX_CONFIG = Object.freeze({
  namespace: 'catcherx-evaluation-v1',
  allowedOrigin: 'https://ryu-mei-15.github.io',
  timezone: 'Asia/Tokyo',
  sessionMinutes: 30,
  otpMinutes: 60,
  maxFailedLogins: 5,
  failedLoginWindowSeconds: 900,
  participantSheet: 'Participants',
  participantImportSheet: 'ParticipantImport',
  assignmentSheet: 'StudyAssignments',
  assignmentImportSheet: 'AssignmentImport',
  studyConfigSheet: 'StudyConfig',
  responseSheet: 'PostTaskResponses',
  profileSheet: 'ParticipantProfiles',
  otpIssueSheet: 'OtpIssue',
  studyId: 'ec-special-issue-2027',
  protocolVersion: 'single-assist-v1',
  questionnaireVersion: 'post-task-v1',
  conditionCode: 'assist_enabled',
  responseType: 'post_task'
});

const PARTICIPANT_HEADERS = [
  'participant_id', 'otp_hash', 'otp_salt', 'otp_expires_at',
  'otp_used_at', 'active', 'allowed_conditions', 'notes'
];
const LEGACY_PARTICIPANT_HEADERS = [
  'participant_id', 'password_hash', 'password_salt', 'active',
  'allowed_conditions', 'notes'
];
const PARTICIPANT_IMPORT_HEADERS = ['participant_id', 'allowed_conditions', 'active', 'notes'];
const ASSIGNMENT_HEADERS = ['participant_id', 'session_id', 'trial_block_id', 'active', 'notes'];
const STUDY_CONFIG_HEADERS = ['key', 'value', 'notes'];
const RESPONSE_HEADERS = [
  'response_id', 'study_id', 'protocol_version', 'questionnaire_version', 'app_version',
  'participant_id', 'session_id', 'trial_block_id', 'condition_code', 'response_type',
  'recorded_date', 'saved_at', 'tlx_method', 'tlx_ratings_json', 'tlx_score',
  'operation_ratings_json', 'difficulty_comment', 'sus_responses_json', 'sus_score'
];
const PROFILE_HEADERS = [
  'participant_id', 'recorded_session_id', 'baseball_experience', 'baseball_years',
  'catcher_experience', 'catcher_years', 'competition_history', 'recent_play_status',
  'vr_hmd_experience', 'dominant_hand', 'saved_at'
];
const OTP_ISSUE_HEADERS = ['participant_id', 'otp', 'expires_at', 'issued_at'];
const TLX_KEYS = ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration'];
const OPERATION_KEYS = ['directionReflection', 'unintendedDirection', 'catchToTransfer', 'transferToThrow'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CatcherX')
    .addItem('初期設定・シート更新', 'setupCatcherXEvaluation')
    .addItem('固定IDを取り込む', 'importParticipantsFromSheet')
    .addItem('実験割当を取り込む', 'importAssignmentsFromSheet')
    .addSeparator()
    .addItem('選択したIDへOTPを発行', 'issueOtpsForSelectedParticipants')
    .addItem('有効な全IDへOTPを発行', 'issueOtpsForAllActiveParticipants')
    .addItem('OTP発行一覧を消去', 'clearOtpIssueSheet').addToUi();
}

function setupCatcherXEvaluation() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('回答保存用スプレッドシートに関連付けてください．');
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  if (!properties.getProperty('ALLOWED_ORIGIN')) properties.setProperty('ALLOWED_ORIGIN', CATCHERX_CONFIG.allowedOrigin);
  if (!properties.getProperty('OTP_PEPPER')) properties.setProperty('OTP_PEPPER', properties.getProperty('PASSWORD_PEPPER') || createSecret_());
  if (!properties.getProperty('SESSION_SECRET')) properties.setProperty('SESSION_SECRET', createSecret_());
  ensureParticipantSheet_(spreadsheet);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.participantImportSheet, PARTICIPANT_IMPORT_HEADERS);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.assignmentSheet, ASSIGNMENT_HEADERS);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.assignmentImportSheet, ASSIGNMENT_HEADERS);
  ensureStudyConfigSheet_(spreadsheet);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.responseSheet, RESPONSE_HEADERS);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.profileSheet, PROFILE_HEADERS);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.otpIssueSheet, OTP_ISSUE_HEADERS);
  migrateLegacyImportSheet_(spreadsheet);
  SpreadsheetApp.getUi().alert('初期設定が完了しました．StudyConfigのapp_versionとAssignmentImportの実験割当を確認してください．');
}

function importParticipantsFromSheet() {
  const spreadsheet = getSpreadsheet_();
  const source = ensureSheet_(spreadsheet, CATCHERX_CONFIG.participantImportSheet, PARTICIPANT_IMPORT_HEADERS);
  const target = ensureParticipantSheet_(spreadsheet);
  const existing = getDataObjects_(target);
  const byId = new Map(existing.map((row, index) => [String(row.participant_id), { row, rowNumber: index + 2 }]));
  let imported = 0;
  const skipped = [];
  getDataObjects_(source).forEach((row, index) => {
    const participantId = String(row.participant_id || '').trim();
    if (!participantId) return;
    if (!isValidParticipantId_(participantId)) { skipped.push(`${participantId}（${index + 2}行）`); return; }
    const current = byId.get(participantId);
    const values = [
      participantId, current ? current.row.otp_hash : '', current ? current.row.otp_salt : '',
      current ? current.row.otp_expires_at : '', current ? current.row.otp_used_at : '',
      normalizeBoolean_(row.active, true), String(row.allowed_conditions || ''), String(row.notes || '')
    ];
    if (current) target.getRange(current.rowNumber, 1, 1, values.length).setValues([values]);
    else target.appendRow(values);
    imported += 1;
  });
  const skippedMessage = skipped.length ? `\n正の整数IDではないため除外: ${skipped.join('，')}` : '';
  SpreadsheetApp.getUi().alert(`${imported}件の固定IDを取り込みました．${skippedMessage}`);
}

function importAssignmentsFromSheet() {
  const spreadsheet = getSpreadsheet_();
  const source = ensureSheet_(spreadsheet, CATCHERX_CONFIG.assignmentImportSheet, ASSIGNMENT_HEADERS);
  const target = ensureSheet_(spreadsheet, CATCHERX_CONFIG.assignmentSheet, ASSIGNMENT_HEADERS);
  const byKey = new Map(getDataObjects_(target).map((row, index) => [`${row.participant_id}|${row.session_id}`, index + 2]));
  let imported = 0;
  getDataObjects_(source).forEach(row => {
    const participantId = String(row.participant_id || '').trim();
    validateParticipantId_(participantId);
    if (!findParticipant_(participantId)) throw new Error(`参加者ID ${participantId} がParticipantsに登録されていません．`);
    const sessionId = validateIdentifier_(row.session_id, '実験回ID');
    const trialBlockId = validateIdentifier_(row.trial_block_id, '試行ブロックID');
    const active = normalizeBoolean_(row.active, true);
    if (active) {
      getDataObjects_(target).forEach((current, index) => {
        if (String(current.participant_id) === participantId && String(current.session_id) !== sessionId && normalizeBoolean_(current.active, false)) {
          target.getRange(index + 2, 4).setValue(false);
        }
      });
    }
    const values = [participantId, sessionId, trialBlockId, active, String(row.notes || '')];
    const key = `${participantId}|${sessionId}`;
    if (byKey.has(key)) target.getRange(byKey.get(key), 1, 1, values.length).setValues([values]);
    else { target.appendRow(values); byKey.set(key, target.getLastRow()); }
    imported += 1;
  });
  SpreadsheetApp.getUi().alert(`${imported}件の実験回・試行ブロック割当を取り込みました．`);
}

function issueOtpsForSelectedParticipants() {
  const sheet = ensureParticipantSheet_(getSpreadsheet_());
  const range = SpreadsheetApp.getActiveRange();
  if (!range || range.getSheet().getName() !== CATCHERX_CONFIG.participantSheet) throw new Error('ParticipantsシートでOTPを発行するIDの行を選択してください．');
  const rows = [];
  for (let row = Math.max(2, range.getRow()); row <= range.getLastRow(); row += 1) rows.push(row);
  issueOtpsForRows_(sheet, rows);
}

function issueOtpsForAllActiveParticipants() {
  const sheet = ensureParticipantSheet_(getSpreadsheet_());
  const rows = getDataObjects_(sheet).map((row, index) =>
    normalizeBoolean_(row.active, false) && isValidParticipantId_(String(row.participant_id)) ? index + 2 : null
  ).filter(value => value !== null);
  issueOtpsForRows_(sheet, rows);
}

function issueOtpsForRows_(participantSheet, rowNumbers) {
  if (!rowNumbers.length) throw new Error('OTPを発行できる有効なIDがありません．');
  const issueSheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.otpIssueSheet, OTP_ISSUE_HEADERS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CATCHERX_CONFIG.otpMinutes * 60 * 1000);
  const rows = [];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    rowNumbers.forEach(rowNumber => {
      const values = participantSheet.getRange(rowNumber, 1, 1, PARTICIPANT_HEADERS.length).getValues()[0];
      const participant = Object.fromEntries(PARTICIPANT_HEADERS.map((header, index) => [header, values[index]]));
      const participantId = String(participant.participant_id || '').trim();
      if (!participantId || !normalizeBoolean_(participant.active, false)) return;
      validateParticipantId_(participantId);
      const otp = createOtp_(); const salt = createSecret_().slice(0, 24);
      participantSheet.getRange(rowNumber, 2, 1, 4).setValues([[hashOtp_(otp, salt), salt, expiresAt, '']]);
      rows.push([participantId, otp,
        Utilities.formatDate(expiresAt, CATCHERX_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        Utilities.formatDate(now, CATCHERX_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")]);
    });
    if (rows.length) issueSheet.getRange(issueSheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert(`${rows.length}件の8桁OTPを発行しました．有効時間は${CATCHERX_CONFIG.otpMinutes}分です．`);
}

function clearOtpIssueSheet() {
  const sheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.otpIssueSheet, OTP_ISSUE_HEADERS);
  if (sheet.getLastRow() >= 2) sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
  SpreadsheetApp.getUi().alert('OTP発行一覧を消去しました．');
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const requestId = String(parameters.request_id || '');
  let response;
  try {
    if (parameters.action === 'authenticate') response = authenticate_(parameters);
    else if (parameters.action === 'submit_post_task') response = submitPostTask_(parameters);
    else if (parameters.action === 'save_profile') response = saveProfile_(parameters);
    else throw publicError_('要求された操作を処理できません．');
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    response = { ok: false, message: error && error.publicMessage ? error.publicMessage : '処理中にエラーが発生しました．時間を置いて再度お試しください．' };
  }
  response.namespace = CATCHERX_CONFIG.namespace; response.requestId = requestId;
  return postMessageOutput_(response);
}

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const callback = String(parameters.callback || '');
  if (parameters.action !== 'health' || !/^[A-Za-z_$][\w$\.]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'Invalid request' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const payload = JSON.stringify({
    namespace: CATCHERX_CONFIG.namespace,
    ok: true,
    backendVersion: 'post-task-v1',
    studyId: CATCHERX_CONFIG.studyId
  }).replace(/</g, '\\u003c');
  return ContentService.createTextOutput(`${callback}(${payload});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function authenticate_(parameters) {
  const participantId = String(parameters.participant_id || '').trim();
  const otp = String(parameters.otp || '');
  const scope = String(parameters.scope || 'post_task');
  if (!['post_task', 'profile'].includes(scope)) throw publicError_('認証の利用目的が正しくありません．');
  validateParticipantId_(participantId);
  if (!/^\d{8}$/.test(otp)) throw publicError_('参加者IDまたはOTPが正しくありません．');
  const cache = CacheService.getScriptCache(); const attemptKey = `login:${shortHash_(participantId)}`;
  const failed = Number(cache.get(attemptKey) || 0);
  if (failed >= CATCHERX_CONFIG.maxFailedLogins) throw publicError_('認証試行回数が上限に達しました．15分後に再度お試しください．');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const record = findParticipantRecord_(participantId); const participant = record && record.participant;
    const expiry = participant && participant.otp_expires_at ? new Date(participant.otp_expires_at).getTime() : 0;
    const valid = participant && normalizeBoolean_(participant.active, false) && !participant.otp_used_at &&
      Number.isFinite(expiry) && expiry >= Date.now() &&
      timingSafeEqual_(String(participant.otp_hash || ''), hashOtp_(otp, String(participant.otp_salt || '')));
    if (!valid) {
      cache.put(attemptKey, String(failed + 1), CATCHERX_CONFIG.failedLoginWindowSeconds);
      throw publicError_('参加者IDまたはOTPが正しくないか，OTPが期限切れ・使用済みです．');
    }
    const assignment = getActiveAssignment_(participantId); const study = getStudyConfig_();
    if (scope === 'post_task' && !study.appVersion) throw publicError_('研究設定のappVersionが未設定です．研究担当者へ連絡してください．');
    const token = createSessionToken_(participantId, scope, assignment, study);
    record.sheet.getRange(record.rowNumber, 5).setValue(Utilities.formatDate(new Date(), CATCHERX_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"));
    cache.remove(attemptKey);
    return {
      ok: true, participantId, token, scope, expiresInMinutes: CATCHERX_CONFIG.sessionMinutes,
      serverDate: Utilities.formatDate(new Date(), CATCHERX_CONFIG.timezone, 'yyyy-MM-dd'),
      studyId: study.studyId, protocolVersion: study.protocolVersion,
      questionnaireVersion: study.questionnaireVersion, appVersion: study.appVersion,
      sessionId: assignment.sessionId, trialBlockId: assignment.trialBlockId,
      conditionCode: study.conditionCode, responseType: study.responseType,
      profileExists: profileExists_(participantId)
    };
  } finally { lock.releaseLock(); }
}

function submitPostTask_(parameters) {
  const session = verifySessionToken_(String(parameters.token || ''), 'post_task');
  const validated = validatePostTaskPayload_(parsePayload_(parameters.payload, 30000));
  const participant = findParticipant_(session.sub);
  if (!participant || !normalizeBoolean_(participant.active, false)) throw publicError_('この参加者IDは現在利用できません．');
  verifyCurrentContext_(session, true);
  const now = new Date();
  const recordedDate = Utilities.formatDate(now, CATCHERX_CONFIG.timezone, 'yyyy-MM-dd');
  const savedAt = Utilities.formatDate(now, CATCHERX_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const sheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.responseSheet, RESPONSE_HEADERS);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const rows = getDataObjects_(sheet);
    const sameResponse = rows.find(row => String(row.response_id) === validated.responseId);
    if (sameResponse) {
      const same = String(sameResponse.participant_id) === session.sub && String(sameResponse.session_id) === session.sessionId && String(sameResponse.trial_block_id) === session.trialBlockId;
      if (!same) throw publicError_('回答IDが別の実験記録と重複しています．研究担当者へ連絡してください．');
      return { ok: true, alreadyAccepted: true, responseId: validated.responseId, recordedDate: sameResponse.recorded_date, message: 'この回答はすでに受け付け済みです．' };
    }
    const duplicate = rows.some(row => String(row.participant_id) === session.sub && String(row.session_id) === session.sessionId && String(row.trial_block_id) === session.trialBlockId && String(row.response_type) === CATCHERX_CONFIG.responseType);
    if (duplicate) throw publicError_('この実験回・試行ブロックの回答はすでに登録されています．自動上書きは行いません．');
    sheet.appendRow([
      validated.responseId, session.studyId, session.protocolVersion, session.questionnaireVersion, session.appVersion,
      session.sub, session.sessionId, session.trialBlockId, session.conditionCode, session.responseType,
      recordedDate, savedAt, 'raw', JSON.stringify(validated.tlxRatings), validated.tlxScore,
      JSON.stringify(validated.operationRatings), safeSheetText_(validated.difficultyComment),
      JSON.stringify(validated.susResponses), validated.susScore
    ]);
  } finally { lock.releaseLock(); }
  return { ok: true, responseId: validated.responseId, recordedDate, message: '本試行後アンケートを受け付けました．' };
}

function saveProfile_(parameters) {
  const session = verifySessionToken_(String(parameters.token || ''), 'profile');
  verifyCurrentContext_(session, false);
  const data = validateProfilePayload_(parsePayload_(parameters.payload, 12000));
  const sheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.profileSheet, PROFILE_HEADERS);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (getDataObjects_(sheet).some(row => String(row.participant_id) === session.sub)) {
      return { ok: true, alreadyRegistered: true, message: '事前情報はすでに登録済みです．重複登録は行いませんでした．' };
    }
    sheet.appendRow([
      session.sub, session.sessionId, data.baseballExperience, data.baseballYears,
      data.catcherExperience, data.catcherYears, safeSheetText_(data.competitionHistory),
      safeSheetText_(data.recentPlayStatus), data.vrHmdExperience, data.dominantHand,
      Utilities.formatDate(new Date(), CATCHERX_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")
    ]);
  } finally { lock.releaseLock(); }
  return { ok: true, message: '事前情報を登録しました．' };
}

function validatePostTaskPayload_(payload) {
  const responseId = String(payload.responseId || '');
  if (!/^[A-Za-z0-9-]{8,80}$/.test(responseId)) throw publicError_('回答IDの形式が正しくありません．');
  const ratings = {};
  TLX_KEYS.forEach(key => {
    if (!payload.tlxRatings || !Object.prototype.hasOwnProperty.call(payload.tlxRatings, key)) throw publicError_('NASA-TLXの6項目すべてを確定してください．');
    const value = Number(payload.tlxRatings[key]);
    if (!Number.isInteger(value) || value < 0 || value > 100 || value % 5 !== 0) throw publicError_('NASA-TLXの回答値が正しくありません．');
    ratings[key] = value;
  });
  const operationRatings = {};
  OPERATION_KEYS.forEach(key => {
    const item = payload.operationRatings && payload.operationRatings[key];
    if (!item || !['answered', 'not_experienced'].includes(item.status)) throw publicError_('操作感4項目すべてに回答してください．');
    if (item.status === 'answered') {
      const value = Number(item.value);
      if (!Number.isInteger(value) || value < 1 || value > 7) throw publicError_('操作感の回答値が正しくありません．');
      operationRatings[key] = { status: 'answered', value };
    } else {
      if (item.value !== null) throw publicError_('判断不能回答の形式が正しくありません．');
      operationRatings[key] = { status: 'not_experienced', value: null };
    }
  });
  const difficultyComment = String(payload.difficultyComment || '');
  if (difficultyComment.length > 2000) throw publicError_('自由記述は2,000文字以内で入力してください．');
  const susResponses = Array.isArray(payload.susResponses) ? payload.susResponses.map(Number) : [];
  if (susResponses.length !== 10 || susResponses.some(value => !Number.isInteger(value) || value < 1 || value > 5)) throw publicError_('SUSの10項目すべてに回答してください．');
  const tlxScore = Object.values(ratings).reduce((sum, value) => sum + value, 0) / 6;
  const susContribution = susResponses.reduce((sum, value, index) => sum + (index % 2 === 0 ? value - 1 : 5 - value), 0);
  return { responseId, tlxRatings: ratings, tlxScore, operationRatings, difficultyComment, susResponses, susScore: susContribution * 2.5 };
}

function validateProfilePayload_(payload) {
  const baseballExperience = validateChoice_(payload.baseballExperience, ['yes', 'no'], '野球経験');
  const catcherExperience = validateChoice_(payload.catcherExperience, ['yes', 'no'], '捕手経験');
  const vrHmdExperience = validateChoice_(payload.vrHmdExperience, ['yes', 'no'], 'VR HMD使用経験');
  const dominantHand = validateChoice_(payload.dominantHand, ['right', 'left', 'both'], '利き手');
  return {
    baseballExperience,
    baseballYears: baseballExperience === 'yes' ? validateYears_(payload.baseballYears, '野球経験年数') : '',
    catcherExperience,
    catcherYears: catcherExperience === 'yes' ? validateYears_(payload.catcherYears, '捕手経験年数') : '',
    competitionHistory: catcherExperience === 'yes' ? validateText_(payload.competitionHistory, 1000, '捕手としての競技歴', true) : '',
    recentPlayStatus: catcherExperience === 'yes' ? validateText_(payload.recentPlayStatus, 1000, '最近のプレイ状況', true) : '',
    vrHmdExperience, dominantHand
  };
}

function verifyCurrentContext_(session, requireAppVersion) {
  const assignment = getActiveAssignment_(session.sub); const study = getStudyConfig_();
  if (assignment.sessionId !== session.sessionId || assignment.trialBlockId !== session.trialBlockId) throw publicError_('認証後に実験回または試行ブロックの設定が変更されました．再度ログインしてください．');
  if (requireAppVersion && !study.appVersion) throw publicError_('研究設定のappVersionが未設定です．');
  if (study.studyId !== session.studyId || study.protocolVersion !== session.protocolVersion || study.questionnaireVersion !== session.questionnaireVersion || study.appVersion !== session.appVersion || study.conditionCode !== session.conditionCode || study.responseType !== session.responseType) throw publicError_('認証後に研究設定が変更されました．再度ログインしてください．');
}

function getActiveAssignment_(participantId) {
  const rows = getDataObjects_(ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.assignmentSheet, ASSIGNMENT_HEADERS))
    .filter(row => String(row.participant_id) === participantId && normalizeBoolean_(row.active, false));
  if (rows.length !== 1) throw publicError_('有効な実験回・試行ブロックを一意に確認できません．研究担当者へ連絡してください．');
  return { sessionId: validateIdentifier_(rows[0].session_id, '実験回ID'), trialBlockId: validateIdentifier_(rows[0].trial_block_id, '試行ブロックID') };
}

function ensureStudyConfigSheet_(spreadsheet) {
  const sheet = ensureSheet_(spreadsheet, CATCHERX_CONFIG.studyConfigSheet, STUDY_CONFIG_HEADERS);
  const existing = new Set(getDataObjects_(sheet).map(row => String(row.key)));
  [
    ['study_id', CATCHERX_CONFIG.studyId, '内部識別子'],
    ['protocol_version', CATCHERX_CONFIG.protocolVersion, '実験プロトコル'],
    ['questionnaire_version', CATCHERX_CONFIG.questionnaireVersion, '設問版'],
    ['condition_code', CATCHERX_CONFIG.conditionCode, '単一条件'],
    ['response_type', CATCHERX_CONFIG.responseType, '回答種別'],
    ['app_version', '', '実験に使用するCatcherXビルド番号を本番前に設定']
  ].filter(row => !existing.has(row[0])).forEach(row => sheet.appendRow(row));
  return sheet;
}

function getStudyConfig_() {
  const values = Object.fromEntries(getDataObjects_(ensureStudyConfigSheet_(getSpreadsheet_())).map(row => [String(row.key), String(row.value || '').trim()]));
  const fixed = { studyId: CATCHERX_CONFIG.studyId, protocolVersion: CATCHERX_CONFIG.protocolVersion, questionnaireVersion: CATCHERX_CONFIG.questionnaireVersion, conditionCode: CATCHERX_CONFIG.conditionCode, responseType: CATCHERX_CONFIG.responseType };
  if (values.study_id !== fixed.studyId || values.protocol_version !== fixed.protocolVersion || values.questionnaire_version !== fixed.questionnaireVersion || values.condition_code !== fixed.conditionCode || values.response_type !== fixed.responseType) throw publicError_('StudyConfigの固定識別子が仕様と一致しません．研究担当者へ連絡してください．');
  return { ...fixed, appVersion: values.app_version || '' };
}

function profileExists_(participantId) {
  return getDataObjects_(ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.profileSheet, PROFILE_HEADERS)).some(row => String(row.participant_id) === participantId);
}

function createSessionToken_(participantId, scope, assignment, study) {
  const claims = { sub: participantId, scope, sessionId: assignment.sessionId, trialBlockId: assignment.trialBlockId, studyId: study.studyId, protocolVersion: study.protocolVersion, questionnaireVersion: study.questionnaireVersion, appVersion: study.appVersion, conditionCode: study.conditionCode, responseType: study.responseType, exp: Date.now() + CATCHERX_CONFIG.sessionMinutes * 60 * 1000, nonce: Utilities.getUuid() };
  const payload = base64Url_(JSON.stringify(claims)); return `${payload}.${sign_(payload, 'SESSION_SECRET')}`;
}

function verifySessionToken_(token, scope) {
  const parts = token.split('.');
  if (parts.length !== 2 || !timingSafeEqual_(sign_(parts[0], 'SESSION_SECRET'), parts[1])) throw publicError_('認証の有効性を確認できません．再度ログインしてください．');
  let payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (error) { throw publicError_('認証の有効性を確認できません．再度ログインしてください．'); }
  if (!payload.sub || Number(payload.exp) < Date.now() || payload.scope !== scope) throw publicError_('認証の有効期限が切れました．再度ログインしてください．');
  return payload;
}

function parsePayload_(raw, maxLength) {
  if (String(raw || '').length > maxLength) throw publicError_('回答データのサイズが上限を超えています．');
  try { return JSON.parse(String(raw || '{}')); } catch (error) { throw publicError_('回答データの形式が正しくありません．'); }
}
function validateChoice_(value, allowed, label) { const text = String(value || ''); if (!allowed.includes(text)) throw publicError_(`${label}へ回答してください．`); return text; }
function validateYears_(value, label) { const number = Number(value); if (!Number.isFinite(number) || number < 0 || number > 80) throw publicError_(`${label}を0〜80年で入力してください．`); return number; }
function validateText_(value, max, label, required) { const text = String(value || '').trim(); if (required && !text) throw publicError_(`${label}を入力してください．`); if (text.length > max) throw publicError_(`${label}は${max}文字以内で入力してください．`); return text; }
function validateIdentifier_(value, label) { const text = String(value || '').trim(); if (!/^[A-Za-z0-9._-]{1,64}$/.test(text)) throw publicError_(`${label}が未設定または形式不正です．`); return text; }
function findParticipant_(id) { const record = findParticipantRecord_(id); return record ? record.participant : null; }
function findParticipantRecord_(id) { const sheet = ensureParticipantSheet_(getSpreadsheet_()); const rows = getDataObjects_(sheet); const index = rows.findIndex(row => String(row.participant_id) === id); return index < 0 ? null : { participant: rows[index], rowNumber: index + 2, sheet }; }
function validateParticipantId_(id) { if (!isValidParticipantId_(id)) throw publicError_('参加者IDまたはOTPが正しくありません．'); }
function isValidParticipantId_(id) { return /^[1-9]\d{0,8}$/.test(String(id)); }

function ensureParticipantSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CATCHERX_CONFIG.participantSheet); if (!sheet) sheet = spreadsheet.insertSheet(CATCHERX_CONFIG.participantSheet);
  if (sheet.getLastRow() === 0) { sheet.getRange(1, 1, 1, PARTICIPANT_HEADERS.length).setValues([PARTICIPANT_HEADERS]); sheet.setFrozenRows(1); return sheet; }
  const actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  if (actual.join('|') === PARTICIPANT_HEADERS.join('|')) return sheet;
  if (actual.join('|') !== LEGACY_PARTICIPANT_HEADERS.join('|')) throw new Error('Participantsシートの列見出しが想定と異なります．');
  const migrated = getDataObjects_(sheet).map(row => [row.participant_id, '', '', '', '', row.active, row.allowed_conditions, row.notes]);
  sheet.clearContents(); sheet.getRange(1, 1, 1, PARTICIPANT_HEADERS.length).setValues([PARTICIPANT_HEADERS]);
  if (migrated.length) sheet.getRange(2, 1, migrated.length, PARTICIPANT_HEADERS.length).setValues(migrated);
  sheet.setFrozenRows(1); return sheet;
}

function migrateLegacyImportSheet_(spreadsheet) {
  const legacy = spreadsheet.getSheetByName('CredentialImport'); if (!legacy || legacy.getLastRow() < 1) return;
  const headers = legacy.getRange(1, 1, 1, legacy.getLastColumn()).getValues()[0].map(String);
  if (headers.join('|') !== ['participant_id', 'password', 'allowed_conditions', 'active', 'notes'].join('|')) return;
  const target = ensureSheet_(spreadsheet, CATCHERX_CONFIG.participantImportSheet, PARTICIPANT_IMPORT_HEADERS);
  const rows = getDataObjects_(legacy).filter(row => String(row.participant_id || '').trim()).map(row => [row.participant_id, row.allowed_conditions, row.active, row.notes]);
  if (rows.length && target.getLastRow() === 1) target.getRange(2, 1, rows.length, PARTICIPANT_IMPORT_HEADERS.length).setValues(rows);
  if (legacy.getLastRow() >= 2) legacy.getRange(2, 2, legacy.getLastRow() - 1, 1).clearContent();
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name); if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.getRange(1, 1, 1, headers.length).setValues([headers]); sheet.setFrozenRows(1); }
  const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
  if (actual.join('|') !== headers.join('|')) throw new Error(`${name}シートの列見出しが想定と異なります．`);
  return sheet;
}
function getDataObjects_(sheet) { if (sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(String); return values.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]]))); }
function getSpreadsheet_() { const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); if (!id) throw new Error('SPREADSHEET_IDが設定されていません．初期設定を実行してください．'); return SpreadsheetApp.openById(id); }
function hashOtp_(otp, salt) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(`${salt}:${otp}`, requiredProperty_('OTP_PEPPER'))).replace(/=+$/g, ''); }
function sign_(value, name) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value, requiredProperty_(name))).replace(/=+$/g, ''); }
function shortHash_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).replace(/=+$/g, '').slice(0, 20); }
function base64Url_(value) { return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, ''); }
function timingSafeEqual_(left, right) { const a = String(left); const b = String(right); let difference = a.length ^ b.length; const length = Math.max(a.length, b.length); for (let index = 0; index < length; index += 1) difference |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(index % Math.max(b.length, 1)) || 0); return difference === 0; }
function requiredProperty_(name) { const value = PropertiesService.getScriptProperties().getProperty(name); if (!value) throw new Error(`${name}が設定されていません．`); return value; }
function createSecret_() { return `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, ''); }
function createOtp_() { return String(parseInt(createSecret_().slice(0, 12), 16) % 100000000).padStart(8, '0'); }
function normalizeBoolean_(value, fallback) { if (value === true || String(value).toLowerCase() === 'true' || String(value) === '1') return true; if (value === false || String(value).toLowerCase() === 'false' || String(value) === '0') return false; return fallback; }
function safeSheetText_(value) { const text = String(value || ''); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function publicError_(message) { const error = new Error(message); error.publicMessage = message; return error; }
function postMessageOutput_(response) { const originValue = PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGIN') || CATCHERX_CONFIG.allowedOrigin; const payload = JSON.stringify(response).replace(/</g, '\\u003c'); const origin = JSON.stringify(originValue).replace(/</g, '\\u003c'); return HtmlService.createHtmlOutput(`<script>window.top.postMessage(${payload},${origin});</script>`).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); }
