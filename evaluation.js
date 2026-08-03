const EVALUATION_NAMESPACE = 'catcherx-evaluation-v1';
const evaluationConfig = window.CATCHERX_EVALUATION_CONFIG || { endpoint: '' };

const tlxDimensions = [
    { key: 'mental', label: '精神的要求' },
    { key: 'physical', label: '身体的要求' },
    { key: 'temporal', label: '時間的要求' },
    { key: 'performance', label: '作業成績' },
    { key: 'effort', label: '努力' },
    { key: 'frustration', label: '不満' }
];

const susItems = [
    'CatcherXを頻繁に利用したいと思う',
    'CatcherXは必要以上に複雑だと感じる',
    'CatcherXは使いやすいと感じる',
    'CatcherXを利用するには技術的な支援が必要だと思う',
    'CatcherXの各機能はうまく統合されていると感じる',
    'CatcherXには一貫していない部分が多いと感じる',
    '多くの人がCatcherXの使い方をすぐに習得できると思う',
    'CatcherXは扱いにくいと感じる',
    'CatcherXを利用することに自信がある',
    'CatcherXを使い始める前に多くのことを学ぶ必要がある'
];

const authenticationForm = document.getElementById('authenticationForm');
const evaluationForm = document.getElementById('evaluationForm');
const pairwiseContainer = document.getElementById('pairwiseComparisons');
const susContainer = document.getElementById('susQuestions');
const weightingPanel = document.getElementById('weightingPanel');
const transportFrame = document.getElementById('evaluationTransport');
const pendingRequests = new Map();

const authState = {
    participantId: null,
    token: null,
    serverDate: null,
    allowedConditions: []
};

function endpointIsConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(evaluationConfig.endpoint);
}

function createPairwiseComparisons() {
    const pairs = [];
    for (let first = 0; first < tlxDimensions.length; first += 1) {
        for (let second = first + 1; second < tlxDimensions.length; second += 1) {
            pairs.push([tlxDimensions[first], tlxDimensions[second]]);
        }
    }

    pairwiseContainer.innerHTML = pairs.map((pair, index) => `
        <fieldset class="pairwise-item">
            <legend>${index + 1}. より負荷に寄与した側面</legend>
            <label><input type="radio" name="pair${index}" value="${pair[0].key}"> ${pair[0].label}</label>
            <label><input type="radio" name="pair${index}" value="${pair[1].key}"> ${pair[1].label}</label>
        </fieldset>
    `).join('');
}

function createSusQuestions() {
    susContainer.innerHTML = susItems.map((item, index) => `
        <fieldset class="sus-item">
            <legend><span>${index + 1}</span>${item}</legend>
            <div class="sus-options" aria-label="設問${index + 1}の回答">
                ${[1, 2, 3, 4, 5].map(value => `
                    <label>
                        <input type="radio" name="sus${index + 1}" value="${value}">
                        <span>${value}</span>
                    </label>
                `).join('')}
            </div>
        </fieldset>
    `).join('');
}

function getTlxRatings() {
    return Object.fromEntries(tlxDimensions.map(dimension => [
        dimension.key,
        Number(evaluationForm.elements[dimension.key].value)
    ]));
}

function getPairwiseWeights() {
    const weights = Object.fromEntries(tlxDimensions.map(dimension => [dimension.key, 0]));
    let completed = 0;

    for (let index = 0; index < 15; index += 1) {
        const selected = evaluationForm.querySelector(`input[name="pair${index}"]:checked`);
        if (selected) {
            weights[selected.value] += 1;
            completed += 1;
        }
    }

    return { weights, completed };
}

function calculateTlx() {
    const ratings = getTlxRatings();
    const method = evaluationForm.elements.tlxMethod.value;
    const rawScore = Object.values(ratings).reduce((sum, value) => sum + value, 0) / 6;
    const { weights, completed } = getPairwiseWeights();
    const weightedScore = completed === 15
        ? tlxDimensions.reduce((sum, dimension) => sum + ratings[dimension.key] * weights[dimension.key], 0) / 15
        : null;

    return {
        method,
        ratings,
        weights,
        weightsCompleted: completed,
        rawScore,
        score: method === 'weighted' ? weightedScore : rawScore
    };
}

function getSusResponses() {
    return susItems.map((_, index) => {
        const selected = evaluationForm.querySelector(`input[name="sus${index + 1}"]:checked`);
        return selected ? Number(selected.value) : null;
    });
}

function calculateSus(responses) {
    if (responses.some(value => value === null)) return null;
    const contribution = responses.reduce((sum, response, index) =>
        sum + (index % 2 === 0 ? response - 1 : 5 - response), 0
    );
    return contribution * 2.5;
}

function updateLiveScores() {
    const tlx = calculateTlx();
    const tlxScore = document.getElementById('tlxLiveScore');
    const tlxMethod = document.getElementById('tlxScoreMethod');

    if (tlx.method === 'weighted' && tlx.score === null) {
        tlxScore.textContent = '—';
        tlxMethod.textContent = `一対比較 ${tlx.weightsCompleted} / 15`;
    } else {
        tlxScore.textContent = tlx.score.toFixed(1);
        tlxMethod.textContent = tlx.method === 'weighted' ? '重み付きNASA-TLX' : 'Raw TLX';
    }

    tlxDimensions.forEach(dimension => {
        const input = evaluationForm.elements[dimension.key];
        input.closest('.scale-slider').querySelector('output').textContent = input.value;
    });

    const susResponses = getSusResponses();
    const completed = susResponses.filter(value => value !== null).length;
    const susScore = calculateSus(susResponses);
    document.getElementById('susLiveScore').textContent = susScore === null ? '—' : susScore.toFixed(1);
    document.getElementById('susCompletion').textContent = `${completed} / 10項目回答`;
}

function updateMethodVisibility() {
    const weighted = evaluationForm.elements.tlxMethod.value === 'weighted';
    weightingPanel.open = weighted;
    weightingPanel.classList.toggle('required-weighting', weighted);
    updateLiveScores();
}

function makeRequestId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function postToBackend(action, values) {
    if (!endpointIsConfigured()) {
        return Promise.reject(new Error('回答収集用の接続先が設定されていません．'));
    }

    const requestId = makeRequestId();
    const postForm = document.createElement('form');
    postForm.method = 'POST';
    postForm.action = evaluationConfig.endpoint;
    postForm.target = transportFrame.name;
    postForm.hidden = true;

    Object.entries({ action, request_id: requestId, ...values }).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value);
        postForm.appendChild(input);
    });

    document.body.appendChild(postForm);
    const response = new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error('サーバから応答がありません．接続設定を確認してください．'));
        }, 20000);
        pendingRequests.set(requestId, { resolve, reject, timeout });
    });

    postForm.submit();
    postForm.remove();
    return response;
}

function isTrustedTransportOrigin(origin) {
    try {
        const url = new URL(origin);
        return url.protocol === 'https:' && (
            url.hostname === 'script.google.com' ||
            url.hostname === 'script.googleusercontent.com' ||
            url.hostname.endsWith('.googleusercontent.com')
        );
    } catch {
        return false;
    }
}

window.addEventListener('message', event => {
    if (!isTrustedTransportOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.namespace !== EVALUATION_NAMESPACE || !data.requestId) return;
    const pending = pendingRequests.get(data.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    pendingRequests.delete(data.requestId);
    pending.resolve(data);
});

function setAuthenticationMessage(message, type = '') {
    const target = document.getElementById('authenticationMessage');
    target.textContent = message;
    target.dataset.type = type;
}

function populateConditions(conditions) {
    const select = evaluationForm.elements.condition;
    select.innerHTML = '<option value="">選択してください</option>' + conditions.map(condition =>
        `<option value="${escapeHtml(condition)}">${escapeHtml(condition)}</option>`
    ).join('');
}

function enterAuthenticatedState(response) {
    authState.participantId = response.participantId;
    authState.token = response.token;
    authState.serverDate = response.serverDate;
    authState.allowedConditions = response.allowedConditions;

    authenticationForm.hidden = true;
    document.getElementById('authenticatedParticipant').hidden = false;
    document.getElementById('authenticatedParticipantId').textContent = response.participantId;
    document.getElementById('authenticationExpiry').textContent = `認証有効時間 ${response.expiresInMinutes}分`;
    evaluationForm.hidden = false;
    evaluationForm.elements.participantId.value = response.participantId;
    evaluationForm.elements.recordedDate.value = response.serverDate;
    populateConditions(response.allowedConditions);
    setAuthenticationMessage('認証が完了しました．質問紙へ回答してください．', 'success');
    evaluationForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function leaveAuthenticatedState(message = '') {
    authState.participantId = null;
    authState.token = null;
    authState.serverDate = null;
    authState.allowedConditions = [];
    evaluationForm.reset();
    evaluationForm.hidden = true;
    authenticationForm.hidden = false;
    document.getElementById('authenticatedParticipant').hidden = true;
    document.getElementById('loginPassword').value = '';
    setAuthenticationMessage(message);
    updateMethodVisibility();
}

authenticationForm.addEventListener('submit', async event => {
    event.preventDefault();
    const loginButton = document.getElementById('loginButton');
    const participantId = authenticationForm.elements.participantId.value.trim();
    const password = authenticationForm.elements.password.value;
    loginButton.disabled = true;
    setAuthenticationMessage('認証情報を確認しています．');

    try {
        const response = await postToBackend('authenticate', {
            participant_id: participantId,
            password
        });
        document.getElementById('loginPassword').value = '';
        if (!response.ok) {
            setAuthenticationMessage(response.message, 'error');
            return;
        }
        enterAuthenticatedState(response);
    } catch (error) {
        document.getElementById('loginPassword').value = '';
        setAuthenticationMessage(error.message, 'error');
    } finally {
        loginButton.disabled = false;
    }
});

document.getElementById('logoutButton').addEventListener('click', () => {
    leaveAuthenticatedState('ログアウトしました．');
});

evaluationForm.addEventListener('input', updateLiveScores);
evaluationForm.elements.tlxMethod.forEach(input => input.addEventListener('change', updateMethodVisibility));

evaluationForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('formMessage');
    const submitButton = evaluationForm.querySelector('.save-response');
    if (!authState.token) {
        message.textContent = '認証の有効性を確認できません．再度ログインしてください．';
        leaveAuthenticatedState(message.textContent);
        return;
    }

    const tlx = calculateTlx();
    const susResponses = getSusResponses();
    const susScore = calculateSus(susResponses);

    if (tlx.method === 'weighted' && tlx.score === null) {
        message.textContent = '重み付き方式では15組すべての一対比較に回答してください．';
        weightingPanel.open = true;
        weightingPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (susScore === null) {
        message.textContent = 'SUSの10項目すべてに回答してください．';
        document.getElementById('sus').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    const payload = {
        condition: evaluationForm.elements.condition.value,
        sessionLabel: evaluationForm.elements.sessionLabel.value.trim(),
        tlxMethod: tlx.method,
        tlxRatings: tlx.ratings,
        tlxWeights: tlx.weights,
        susResponses
    };

    submitButton.disabled = true;
    message.textContent = '回答を送信しています．';
    try {
        const response = await postToBackend('submit', {
            token: authState.token,
            payload: JSON.stringify(payload)
        });
        if (!response.ok) {
            message.textContent = response.message;
            if (response.message.includes('再度ログイン')) leaveAuthenticatedState(response.message);
            return;
        }
        authState.serverDate = response.recordedDate;
        evaluationForm.elements.recordedDate.value = response.recordedDate;
        message.textContent = `${response.participantId}・${response.condition}の回答を受け付けました．実施日：${response.recordedDate}`;
        loadPublicSummary();
        document.getElementById('comparison').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        message.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});

evaluationForm.addEventListener('reset', () => {
    window.setTimeout(() => {
        document.getElementById('formMessage').textContent = '';
        if (authState.participantId) {
            evaluationForm.elements.participantId.value = authState.participantId;
            evaluationForm.elements.recordedDate.value = authState.serverDate;
            populateConditions(authState.allowedConditions);
        }
        updateMethodVisibility();
    }, 0);
});

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatSummary(value, sd) {
    if (value === null || !Number.isFinite(Number(value))) return '—';
    return sd === null ? Number(value).toFixed(1) : `${Number(value).toFixed(1)} ± ${Number(sd).toFixed(1)}`;
}

function renderPublicSummary(groups) {
    const empty = document.getElementById('comparisonEmpty');
    const content = document.getElementById('comparisonContent');
    if (!Array.isArray(groups) || groups.length === 0) {
        empty.hidden = false;
        content.hidden = true;
        empty.textContent = '公開対象の回答データはまだありません．';
        return;
    }

    empty.hidden = true;
    content.hidden = false;
    document.getElementById('conditionComparison').innerHTML = groups.map(group => `
        <article class="condition-result">
            <div><strong>${escapeHtml(group.condition)}</strong><span>n = ${group.n}</span></div>
            <label><span>NASA-TLX</span><i class="tlx-bar" style="width:${Number(group.tlxMean)}%"></i><b>${Number(group.tlxMean).toFixed(1)}</b></label>
            <label><span>SUS</span><i class="sus-bar" style="width:${Number(group.susMean)}%"></i><b>${Number(group.susMean).toFixed(1)}</b></label>
        </article>
    `).join('');

    document.getElementById('summaryTable').innerHTML = `
        <thead><tr><th scope="col">条件</th><th scope="col">n</th><th scope="col">NASA-TLX 平均 ± SD</th><th scope="col">SUS 平均 ± SD</th></tr></thead>
        <tbody>${groups.map(group => `
            <tr>
                <th scope="row">${escapeHtml(group.condition)}</th>
                <td>${group.n}</td>
                <td>${formatSummary(group.tlxMean, group.tlxSd)}</td>
                <td>${formatSummary(group.susMean, group.susSd)}</td>
            </tr>
        `).join('')}</tbody>
    `;
}

window.__catcherxEvaluationSummary = payload => {
    if (!payload || payload.namespace !== EVALUATION_NAMESPACE || !payload.ok) return;
    renderPublicSummary(payload.groups);
};

function loadPublicSummary() {
    if (!endpointIsConfigured()) {
        const empty = document.getElementById('comparisonEmpty');
        empty.textContent = '回答収集用の接続先は現在設定されていません．';
        document.getElementById('comparisonContent').hidden = true;
        return;
    }
    document.getElementById('evaluationSummaryScript')?.remove();
    const script = document.createElement('script');
    script.id = 'evaluationSummaryScript';
    script.src = `${evaluationConfig.endpoint}?action=summary&callback=__catcherxEvaluationSummary&t=${Date.now()}`;
    script.onerror = () => {
        document.getElementById('comparisonEmpty').textContent = '集計結果を読み込めませんでした．';
    };
    document.body.appendChild(script);
}

function initializeEvaluation() {
    createPairwiseComparisons();
    createSusQuestions();
    updateMethodVisibility();
    if (!endpointIsConfigured()) {
        document.getElementById('loginButton').disabled = true;
        setAuthenticationMessage('管理者による回答収集用の接続設定が必要です．', 'error');
    }
    loadPublicSummary();
}

initializeEvaluation();
