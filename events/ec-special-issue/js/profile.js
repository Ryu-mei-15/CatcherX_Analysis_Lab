'use strict';

const PROFILE_NAMESPACE = 'catcherx-evaluation-v1';
const profileConfig = window.CATCHERX_EVALUATION_CONFIG || { endpoint: '' };
const authForm = document.getElementById('profileAuthenticationForm');
const profileForm = document.getElementById('profileForm');
const transport = document.getElementById('profileTransport');
const pending = new Map();
let profileToken = null;

function createId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function request(action, values) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(profileConfig.endpoint)) return Promise.reject(new Error('回答収集用の接続先が設定されていません．'));
    const requestId = createId(); const form = document.createElement('form'); form.method = 'POST'; form.action = profileConfig.endpoint; form.target = transport.name; form.hidden = true;
    Object.entries({ action, request_id: requestId, ...values }).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = String(value); form.appendChild(input); });
    document.body.appendChild(form);
    const result = new Promise((resolve, reject) => { const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error('サーバから応答がありません．接続を確認してください．')); }, 60000); pending.set(requestId, { resolve, timeout }); });
    form.submit(); form.remove(); return result;
}
function trusted(origin) { try { const host = new URL(origin).hostname; return host === 'script.google.com' || host === 'script.googleusercontent.com' || host.endsWith('.googleusercontent.com'); } catch { return false; } }
window.addEventListener('message', event => { if (!trusted(event.origin)) return; const data = event.data; const item = data && data.namespace === PROFILE_NAMESPACE && pending.get(data.requestId); if (!item) return; clearTimeout(item.timeout); pending.delete(data.requestId); item.resolve(data); });
function authMessage(text, type = '') { const target = document.getElementById('profileAuthMessage'); target.textContent = text; target.dataset.type = type; }

function checkBackendVersion() {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(profileConfig.endpoint)) { authMessage('管理者による回答収集用の接続設定が必要です．', 'error'); return; }
    window.__catcherxProfileBackendHealth = payload => {
        document.getElementById('profileBackendHealthScript')?.remove(); delete window.__catcherxProfileBackendHealth;
        if (payload?.ok && payload.backendVersion === 'post-task-v1' && payload.studyId === 'ec-special-issue-2027') {
            document.getElementById('profileLoginButton').disabled = false; authMessage('回答サーバへの接続を確認しました．');
        } else authMessage('回答サーバを新しい実験仕様へ更新する必要があります．研究担当者へ連絡してください．', 'error');
    };
    const script = document.createElement('script'); script.id = 'profileBackendHealthScript';
    script.src = `${profileConfig.endpoint}?action=health&callback=__catcherxProfileBackendHealth&t=${Date.now()}`;
    script.onerror = () => authMessage('回答サーバを新しい実験仕様へ更新する必要があります．研究担当者へ連絡してください．', 'error');
    document.body.appendChild(script);
}

authForm.addEventListener('submit', async event => {
    event.preventDefault(); const button = document.getElementById('profileLoginButton'); button.disabled = true; authMessage('登録状況を確認しています．');
    try {
        const response = await request('authenticate', { participant_id: authForm.elements.participantId.value.trim(), otp: authForm.elements.otp.value, scope: 'profile' });
        authForm.elements.otp.value = '';
        if (!response.ok) { authMessage(response.message, 'error'); return; }
        if (response.studyId !== 'ec-special-issue-2027' || !response.sessionId) { authMessage('回答サーバが新しい実験仕様へ更新されていません．', 'error'); return; }
        authForm.hidden = true; profileToken = response.token;
        if (response.profileExists) { document.getElementById('profileExistsPanel').hidden = false; authMessage('事前情報は登録済みです．', 'success'); return; }
        document.getElementById('profileParticipantId').textContent = response.participantId;
        document.getElementById('profileSessionId').textContent = response.sessionId;
        profileForm.hidden = false; authMessage('未登録のため，事前情報を入力してください．', 'success');
    } catch (error) { authMessage(error.message, 'error'); }
    finally { button.disabled = false; }
});

function selected(name) { return profileForm.querySelector(`input[name="${name}"]:checked`)?.value || ''; }
function updateConditional() {
    const baseball = selected('baseballExperience') === 'yes'; const catcher = selected('catcherExperience') === 'yes';
    document.getElementById('baseballDetails').hidden = !baseball; document.getElementById('catcherDetails').hidden = !catcher;
    profileForm.elements.baseballYears.required = baseball;
    ['catcherYears', 'competitionHistory', 'recentPlayStatus'].forEach(name => { profileForm.elements[name].required = catcher; });
}
profileForm.addEventListener('change', updateConditional);
profileForm.addEventListener('submit', async event => {
    event.preventDefault(); const message = document.getElementById('profileMessage'); const button = profileForm.querySelector('.save-response'); updateConditional();
    if (!selected('baseballExperience') || !selected('catcherExperience') || !selected('vrHmdExperience') || !selected('dominantHand')) {
        message.textContent = '野球経験，捕手経験，VR HMD使用経験，利き手のすべてに回答してください．';
        return;
    }
    if (!profileForm.reportValidity()) return;
    const payload = { baseballExperience: selected('baseballExperience'), baseballYears: profileForm.elements.baseballYears.value, catcherExperience: selected('catcherExperience'), catcherYears: profileForm.elements.catcherYears.value, competitionHistory: profileForm.elements.competitionHistory.value, recentPlayStatus: profileForm.elements.recentPlayStatus.value, vrHmdExperience: selected('vrHmdExperience'), dominantHand: selected('dominantHand') };
    button.disabled = true; message.textContent = '事前情報を登録しています．';
    try {
        const response = await request('save_profile', { token: profileToken, payload: JSON.stringify(payload) });
        if (!response.ok) { message.textContent = response.message; return; }
        profileForm.hidden = true; const panel = document.getElementById('profileCompletion'); panel.hidden = false; panel.querySelector('p:last-child').textContent = response.message; panel.focus();
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
});
updateConditional();
checkBackendVersion();
