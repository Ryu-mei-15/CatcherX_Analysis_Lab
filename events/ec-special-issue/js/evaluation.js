'use strict';

const EVALUATION_NAMESPACE = 'catcherx-evaluation-v1';
const evaluationConfig = window.CATCHERX_EVALUATION_CONFIG || { endpoint: '' };
const tlxKeys = ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration'];
const operationItems = [
    { key: 'directionReflection', text: '自分が投げようとした方向が，送球結果に反映されたと感じた．' },
    { key: 'unintendedDirection', text: 'システムが，意図と異なる方向へ球を動かしたと感じた．' },
    { key: 'catchToTransfer', text: '捕球後，持ち替えへ移りやすかった．' },
    { key: 'transferToThrow', text: '持ち替え後，送球へ移りやすかった．' }
];
const operationLabels = ['全くそう思わない', 'そう思わない', 'あまりそう思わない', 'どちらともいえない', 'ややそう思う', 'そう思う', '非常にそう思う'];
const susItems = [
    'CatcherXを頻繁に利用したいと思う', 'CatcherXは必要以上に複雑だと感じる',
    'CatcherXは使いやすいと感じる', 'CatcherXを利用するには技術的な支援が必要だと思う',
    'CatcherXの各機能はうまく統合されていると感じる', 'CatcherXには一貫していない部分が多いと感じる',
    '多くの人がCatcherXの使い方をすぐに習得できると思う', 'CatcherXは扱いにくいと感じる',
    'CatcherXを利用することに自信がある', 'CatcherXを使い始める前に多くのことを学ぶ必要がある'
];

const authenticationForm = document.getElementById('authenticationForm');
const evaluationForm = document.getElementById('evaluationForm');
const transportFrame = document.getElementById('evaluationTransport');
const pendingRequests = new Map();
const tlxConfirmed = new Set();
const authState = { participantId: null, token: null, serverDate: null, context: null };
let responseId = createId();

function endpointIsConfigured() { return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(evaluationConfig.endpoint); }
function createId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function draftKey(context = authState.context) { return context ? `catcherx-post-task:${context.participantId}:${context.sessionId}:${context.trialBlockId}` : null; }

function checkBackendVersion() {
    if (!endpointIsConfigured()) {
        setAuthMessage('管理者による回答収集用の接続設定が必要です．', 'error');
        return;
    }
    window.__catcherxBackendHealth = payload => {
        document.getElementById('backendHealthScript')?.remove();
        delete window.__catcherxBackendHealth;
        if (payload?.ok && payload.backendVersion === 'post-task-v1' && payload.studyId === 'ec-special-issue-2027') {
            document.getElementById('loginButton').disabled = false;
            setAuthMessage('回答サーバへの接続を確認しました．');
        } else setAuthMessage('回答サーバを新しい実験仕様へ更新する必要があります．研究担当者へ連絡してください．', 'error');
    };
    const script = document.createElement('script'); script.id = 'backendHealthScript';
    script.src = `${evaluationConfig.endpoint}?action=health&callback=__catcherxBackendHealth&t=${Date.now()}`;
    script.onerror = () => setAuthMessage('回答サーバを新しい実験仕様へ更新する必要があります．研究担当者へ連絡してください．', 'error');
    document.body.appendChild(script);
}

function createOperationQuestions() {
    document.getElementById('operationQuestions').innerHTML = operationItems.map((item, index) => `
        <fieldset class="operation-item">
            <legend><span>${index + 1}</span>${item.text}</legend>
            <div class="operation-options">
                ${operationLabels.map((label, value) => `<label><input type="radio" name="op_${item.key}" value="${value + 1}"><span><b>${value + 1}</b><small>${label}</small></span></label>`).join('')}
                <label class="not-experienced"><input type="radio" name="op_${item.key}" value="not_experienced"><span>体験できず<br>判断できない</span></label>
            </div>
        </fieldset>`).join('');
}

function createSusQuestions() {
    document.getElementById('susQuestions').innerHTML = susItems.map((item, index) => `
        <fieldset class="sus-item"><legend><span>${index + 1}</span>${item}</legend><div class="sus-options" aria-label="設問${index + 1}の回答">
            ${[1, 2, 3, 4, 5].map(value => `<label><input type="radio" name="sus${index + 1}" value="${value}"><span>${value}</span></label>`).join('')}
        </div></fieldset>`).join('');
}

function postToBackend(action, values) {
    if (!endpointIsConfigured()) return Promise.reject(new Error('回答収集用の接続先が設定されていません．'));
    const requestId = createId();
    const form = document.createElement('form');
    form.method = 'POST'; form.action = evaluationConfig.endpoint; form.target = transportFrame.name; form.hidden = true;
    Object.entries({ action, request_id: requestId, ...values }).forEach(([name, value]) => {
        const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = String(value); form.appendChild(input);
    });
    document.body.appendChild(form);
    const response = new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => { pendingRequests.delete(requestId); reject(new Error('サーバから応答がありません．入力内容は保持されています．接続を確認して再送してください．')); }, 60000);
        pendingRequests.set(requestId, { resolve, reject, timeout });
    });
    form.submit(); form.remove(); return response;
}

function isTrustedOrigin(origin) {
    try { const url = new URL(origin); return url.protocol === 'https:' && (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com')); }
    catch { return false; }
}

window.addEventListener('message', event => {
    if (!isTrustedOrigin(event.origin)) return;
    const data = event.data; if (!data || data.namespace !== EVALUATION_NAMESPACE || !data.requestId) return;
    const pending = pendingRequests.get(data.requestId); if (!pending) return;
    window.clearTimeout(pending.timeout); pendingRequests.delete(data.requestId); pending.resolve(data);
});

function setAuthMessage(message, type = '') { const target = document.getElementById('authenticationMessage'); target.textContent = message; target.dataset.type = type; }
function isCurrentBackend(response) { return response.studyId === 'ec-special-issue-2027' && response.protocolVersion === 'single-assist-v1' && response.questionnaireVersion === 'post-task-v1' && response.conditionCode === 'assist_enabled' && response.responseType === 'post_task' && response.sessionId && response.trialBlockId && response.appVersion; }

function enterAuthenticatedState(response) {
    if (!isCurrentBackend(response)) {
        setAuthMessage('回答サーバが新しい実験仕様へ更新されていません．研究担当者へ連絡してください．', 'error');
        return;
    }
    const context = {
        participantId: response.participantId, sessionId: response.sessionId, trialBlockId: response.trialBlockId,
        appVersion: response.appVersion, studyId: response.studyId, protocolVersion: response.protocolVersion,
        questionnaireVersion: response.questionnaireVersion, conditionCode: response.conditionCode, responseType: response.responseType
    };
    if (authState.context && (authState.context.participantId !== context.participantId || authState.context.sessionId !== context.sessionId || authState.context.trialBlockId !== context.trialBlockId)) {
        setAuthMessage('現在の入力内容と異なる参加者・実験回です．前の回答を破棄してから交代してください．', 'error');
        return;
    }
    authState.participantId = response.participantId; authState.token = response.token; authState.serverDate = response.serverDate; authState.context = context;
    authenticationForm.hidden = true; document.getElementById('authenticatedParticipant').hidden = false;
    document.getElementById('authenticatedParticipantId').textContent = response.participantId;
    document.getElementById('authenticationExpiry').textContent = `認証有効時間 ${response.expiresInMinutes}分`;
    document.getElementById('participantIdDisplay').textContent = response.participantId;
    document.getElementById('sessionIdDisplay').textContent = response.sessionId;
    document.getElementById('trialBlockIdDisplay').textContent = response.trialBlockId;
    document.getElementById('appVersionDisplay').textContent = response.appVersion;
    evaluationForm.hidden = false; restoreDraft(); updateProgress();
    setAuthMessage('認証が完了しました．直前の本試行について回答してください．', 'success');
    evaluationForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function expireAuthentication(message) {
    authState.token = null; authenticationForm.hidden = false; document.getElementById('authenticatedParticipant').hidden = true;
    document.getElementById('loginParticipantId').value = authState.participantId || '';
    document.getElementById('loginOtp').value = '';
    setAuthMessage(`${message} 入力内容は保持されています．新しいOTPで再認証してください．`, 'error');
    authenticationForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearForParticipantChange() {
    const key = draftKey(); if (key) sessionStorage.removeItem(key);
    authState.participantId = null; authState.token = null; authState.serverDate = null; authState.context = null;
    responseId = createId(); resetInputs(false); evaluationForm.hidden = true; authenticationForm.hidden = false;
    document.getElementById('authenticatedParticipant').hidden = true; document.getElementById('loginParticipantId').value = ''; document.getElementById('loginOtp').value = '';
    setAuthMessage('入力を破棄してログアウトしました．');
}

authenticationForm.addEventListener('submit', async event => {
    event.preventDefault();
    const requestedParticipantId = authenticationForm.elements.participantId.value.trim();
    if (authState.context && requestedParticipantId !== authState.context.participantId) {
        setAuthMessage('別の参加者へ交代する場合は，先に「回答を破棄して交代」を押してください．', 'error');
        return;
    }
    const button = document.getElementById('loginButton'); button.disabled = true; setAuthMessage('認証情報と実験割当を確認しています．');
    try {
        const response = await postToBackend('authenticate', { participant_id: requestedParticipantId, otp: authenticationForm.elements.otp.value, scope: 'post_task' });
        document.getElementById('loginOtp').value = '';
        if (!response.ok) setAuthMessage(response.message, 'error'); else enterAuthenticatedState(response);
    } catch (error) { setAuthMessage(error.message, 'error'); }
    finally { button.disabled = false; }
});

document.getElementById('logoutButton').addEventListener('click', () => {
    if (window.confirm('この端末に保持している未送信の入力を破棄し，次の参加者へ交代しますか？')) clearForParticipantChange();
});

function getTlxRatings() { return Object.fromEntries(tlxKeys.map(key => [key, Number(evaluationForm.elements[key].value)])); }
function getOperationRatings() {
    return Object.fromEntries(operationItems.map(item => {
        const selected = evaluationForm.querySelector(`input[name="op_${item.key}"]:checked`);
        if (!selected) return [item.key, null];
        return selected.value === 'not_experienced' ? [item.key, { status: 'not_experienced', value: null }] : [item.key, { status: 'answered', value: Number(selected.value) }];
    }));
}
function getSusResponses() { return susItems.map((_, index) => { const selected = evaluationForm.querySelector(`input[name="sus${index + 1}"]:checked`); return selected ? Number(selected.value) : null; }); }

function updateProgress() {
    tlxKeys.forEach(key => {
        const input = evaluationForm.elements[key]; const status = document.querySelector(`[data-tlx-status="${key}"]`);
        input.closest('.scale-slider').querySelector('output').textContent = input.value;
        status.textContent = tlxConfirmed.has(key) ? `${input.value}で回答済み` : '未回答'; status.dataset.confirmed = tlxConfirmed.has(key) ? 'true' : 'false';
    });
    document.getElementById('tlxProgress').textContent = `TLX ${tlxConfirmed.size} / 6回答`;
    const operationCompleted = Object.values(getOperationRatings()).filter(Boolean).length;
    document.getElementById('operationProgress').textContent = `操作感 ${operationCompleted} / 4回答`;
    const susCompleted = getSusResponses().filter(value => value !== null).length;
    document.getElementById('susProgress').textContent = `SUS ${susCompleted} / 10回答`;
    document.getElementById('difficultyCount').textContent = evaluationForm.elements.difficultyComment.value.length;
}

document.querySelectorAll('[data-tlx-confirm]').forEach(button => button.addEventListener('click', () => {
    tlxConfirmed.add(button.dataset.tlxConfirm); updateProgress(); saveDraft();
}));
tlxKeys.forEach(key => evaluationForm.elements[key].addEventListener('input', () => { if (tlxConfirmed.has(key)) tlxConfirmed.delete(key); updateProgress(); saveDraft(); }));
evaluationForm.addEventListener('change', () => { updateProgress(); saveDraft(); });
evaluationForm.elements.difficultyComment.addEventListener('input', () => { updateProgress(); saveDraft(); });

function serializeDraft() {
    const radios = {};
    evaluationForm.querySelectorAll('input[type="radio"]:checked').forEach(input => { radios[input.name] = input.value; });
    return { responseId, tlx: getTlxRatings(), tlxConfirmed: [...tlxConfirmed], radios, difficultyComment: evaluationForm.elements.difficultyComment.value };
}
function saveDraft() { const key = draftKey(); if (key) sessionStorage.setItem(key, JSON.stringify(serializeDraft())); }
function restoreDraft() {
    const key = draftKey(); if (!key) return;
    const raw = sessionStorage.getItem(key); if (!raw) return;
    try {
        const draft = JSON.parse(raw); responseId = draft.responseId || createId();
        tlxKeys.forEach(keyName => { if (Number.isFinite(Number(draft.tlx?.[keyName]))) evaluationForm.elements[keyName].value = draft.tlx[keyName]; });
        tlxConfirmed.clear(); (draft.tlxConfirmed || []).filter(keyName => tlxKeys.includes(keyName)).forEach(keyName => tlxConfirmed.add(keyName));
        Object.entries(draft.radios || {}).forEach(([name, value]) => { const input = evaluationForm.querySelector(`input[name="${CSS.escape(name)}"][value="${CSS.escape(String(value))}"]`); if (input) input.checked = true; });
        evaluationForm.elements.difficultyComment.value = String(draft.difficultyComment || '').slice(0, 2000);
    } catch { sessionStorage.removeItem(key); }
}

function resetInputs(removeDraft = true) {
    if (removeDraft) { const key = draftKey(); if (key) sessionStorage.removeItem(key); }
    evaluationForm.reset(); tlxConfirmed.clear(); responseId = createId(); document.getElementById('formMessage').textContent = ''; updateProgress();
}
document.getElementById('resetResponseButton').addEventListener('click', () => {
    if (window.confirm('入力した回答をすべて未回答の状態へ戻しますか？')) resetInputs(true);
});

evaluationForm.addEventListener('submit', async event => {
    event.preventDefault(); const message = document.getElementById('formMessage'); const button = evaluationForm.querySelector('.save-response');
    if (!authState.token) { expireAuthentication('認証の有効性を確認できません．'); return; }
    if (tlxConfirmed.size !== 6) { message.textContent = 'NASA-TLXの6項目すべてで「この値で回答する」を押してください．'; document.getElementById('nasaTlx').scrollIntoView({ behavior: 'smooth' }); return; }
    const operationRatings = getOperationRatings();
    if (Object.values(operationRatings).some(value => value === null)) { message.textContent = '操作感4項目すべてに回答してください．'; document.getElementById('operationSection').scrollIntoView({ behavior: 'smooth' }); return; }
    const susResponses = getSusResponses();
    if (susResponses.some(value => value === null)) { message.textContent = 'SUSの10項目すべてに回答してください．'; document.getElementById('sus').scrollIntoView({ behavior: 'smooth' }); return; }
    const payload = { responseId, tlxMethod: 'raw', tlxRatings: getTlxRatings(), operationRatings, difficultyComment: evaluationForm.elements.difficultyComment.value, susResponses };
    saveDraft(); button.disabled = true; message.textContent = '回答を送信しています．画面を閉じないでください．';
    try {
        const response = await postToBackend('submit_post_task', { token: authState.token, payload: JSON.stringify(payload) });
        if (!response.ok) { message.textContent = response.message; if (response.message.includes('再度ログイン')) expireAuthentication(response.message); return; }
        const key = draftKey(); if (key) sessionStorage.removeItem(key);
        evaluationForm.hidden = true; document.getElementById('completionMessage').textContent = `${response.message} 受付日：${response.recordedDate}`;
        const panel = document.getElementById('completionPanel'); panel.hidden = false; panel.focus();
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
});

function initialize() {
    createOperationQuestions(); createSusQuestions(); updateProgress();
    checkBackendVersion();
}
initialize();
