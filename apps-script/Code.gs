const CATCHERX_CONFIG = Object.freeze({
  namespace: 'catcherx-evaluation-v1',
  timezone: 'Asia/Tokyo',
  sessionMinutes: 30,
  maxFailedLogins: 5,
  failedLoginWindowSeconds: 900,
  minimumPublicGroupSize: 3,
  participantSheet: 'Participants',
  responseSheet: 'Responses',
  importSheet: 'CredentialImport',
  conditions: ['統合条件', '捕球のみ', '配球判断のみ', 'CatcherX全体']
});

const PARTICIPANT_HEADERS = [
  'participant_id', 'password_hash', 'password_salt', 'active',
  'allowed_conditions', 'notes'
];

const RESPONSE_HEADERS = [
  'response_id', 'participant_id', 'condition', 'session_label',
  'recorded_date', 'saved_at', 'tlx_method', 'tlx_ratings_json',
  'tlx_weights_json', 'tlx_score', 'sus_responses_json', 'sus_score',
  'approved'
];

const IMPORT_HEADERS = [
  'participant_id', 'password', 'allowed_conditions', 'active', 'notes'
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CatcherX')
    .addItem('初期設定', 'setupCatcherXEvaluation')
    .addItem('認証情報を取り込む', 'importCredentialsFromSheet')
    .addItem('認証情報を10件生成', 'generateTenCredentials')
    .addToUi();
}

function setupCatcherXEvaluation() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('このスクリプトを回答保存用スプレッドシートに関連付けてください．');
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  if (!properties.getProperty('PASSWORD_PEPPER')) {
    properties.setProperty('PASSWORD_PEPPER', createSecret_());
  }
  if (!properties.getProperty('SESSION_SECRET')) {
    properties.setProperty('SESSION_SECRET', createSecret_());
  }

  ensureSheet_(spreadsheet, CATCHERX_CONFIG.participantSheet, PARTICIPANT_HEADERS);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.responseSheet, RESPONSE_HEADERS);
  ensureSheet_(spreadsheet, CATCHERX_CONFIG.importSheet, IMPORT_HEADERS);

  SpreadsheetApp.getUi().alert(
    '初期設定が完了しました．スクリプトプロパティ ALLOWED_ORIGIN に公開サイトのオリジンを設定してください．'
  );
}

function generateTenCredentials() {
  generateCredentials_(10, 'P');
}

function generateCredentials_(count, prefix) {
  const spreadsheet = getSpreadsheet_();
  const sheet = ensureSheet_(spreadsheet, CATCHERX_CONFIG.importSheet, IMPORT_HEADERS);
  const existingIds = getDataObjects_(
    ensureSheet_(spreadsheet, CATCHERX_CONFIG.participantSheet, PARTICIPANT_HEADERS)
  ).map(row => row.participant_id).concat(
    getDataObjects_(sheet).map(row => row.participant_id)
  );
  const rows = [];
  let number = 1;

  while (rows.length < count) {
    const participantId = `${prefix}${String(number).padStart(3, '0')}`;
    number += 1;
    if (existingIds.includes(participantId)) continue;
    rows.push([
      participantId,
      createSecret_().replace(/[-_=]/g, '').slice(0, 20),
      CATCHERX_CONFIG.conditions.join('|'),
      true,
      ''
    ]);
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.getUi().alert(
    'CredentialImportシートへ認証情報を生成しました．配布用に安全な場所へ控えた後，「認証情報を取り込む」を実行してください．'
  );
}

function importCredentialsFromSheet() {
  const spreadsheet = getSpreadsheet_();
  const importSheet = ensureSheet_(spreadsheet, CATCHERX_CONFIG.importSheet, IMPORT_HEADERS);
  const participantSheet = ensureSheet_(spreadsheet, CATCHERX_CONFIG.participantSheet, PARTICIPANT_HEADERS);
  const imports = getDataObjects_(importSheet);
  const existing = getDataObjects_(participantSheet);
  const byId = new Map(existing.map((row, index) => [String(row.participant_id), index + 2]));
  let imported = 0;

  imports.forEach((row, index) => {
    const sheetRow = index + 2;
    const participantId = String(row.participant_id || '').trim();
    const password = String(row.password || '');
    if (!participantId && !password) return;
    validateParticipantId_(participantId);
    if (password.length < 12 || password.length > 128) {
      throw new Error(`${participantId}: パスワードは12文字以上128文字以下にしてください．`);
    }

    const conditions = parseConditions_(row.allowed_conditions);
    const salt = createSecret_().slice(0, 24);
    const values = [
      participantId,
      hashPassword_(password, salt),
      salt,
      normalizeBoolean_(row.active, true),
      conditions.join('|'),
      String(row.notes || '')
    ];

    if (byId.has(participantId)) {
      participantSheet.getRange(byId.get(participantId), 1, 1, values.length).setValues([values]);
    } else {
      participantSheet.appendRow(values);
      byId.set(participantId, participantSheet.getLastRow());
    }

    importSheet.getRange(sheetRow, 2).clearContent();
    imported += 1;
  });

  SpreadsheetApp.getUi().alert(
    `${imported}件を取り込みました．CredentialImportシートのパスワード欄は消去済みです．`
  );
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const requestId = String(parameters.request_id || '');
  let response;

  try {
    if (parameters.action === 'authenticate') {
      response = authenticate_(parameters);
    } else if (parameters.action === 'submit') {
      response = submitResponse_(parameters);
    } else {
      throw publicError_('要求された操作を処理できません．');
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    response = {
      ok: false,
      message: error && error.publicMessage
        ? error.publicMessage
        : '処理中にエラーが発生しました．時間を置いて再度お試しください．'
    };
  }

  response.namespace = CATCHERX_CONFIG.namespace;
  response.requestId = requestId;
  return postMessageOutput_(response);
}

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const callback = String(parameters.callback || '');
  if (parameters.action !== 'summary' || !/^[A-Za-z_$][\w$\.]{0,80}$/.test(callback)) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: 'Invalid request' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const payload = JSON.stringify({
    namespace: CATCHERX_CONFIG.namespace,
    ok: true,
    groups: buildPublicSummary_()
  }).replace(/</g, '\\u003c');

  return ContentService
    .createTextOutput(`${callback}(${payload});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function authenticate_(parameters) {
  const participantId = String(parameters.participant_id || '').trim();
  const password = String(parameters.password || '');
  validateParticipantId_(participantId);
  if (password.length < 12 || password.length > 128) {
    throw publicError_('参加者IDまたはパスワードが正しくありません．');
  }

  const cache = CacheService.getScriptCache();
  const attemptKey = `login:${shortHash_(participantId)}`;
  const failedAttempts = Number(cache.get(attemptKey) || 0);
  if (failedAttempts >= CATCHERX_CONFIG.maxFailedLogins) {
    throw publicError_('認証試行回数が上限に達しました．15分後に再度お試しください．');
  }

  const participant = findParticipant_(participantId);
  const valid = participant &&
    normalizeBoolean_(participant.active, false) &&
    timingSafeEqual_(
      String(participant.password_hash || ''),
      hashPassword_(password, String(participant.password_salt || ''))
    );

  if (!valid) {
    cache.put(
      attemptKey,
      String(failedAttempts + 1),
      CATCHERX_CONFIG.failedLoginWindowSeconds
    );
    throw publicError_('参加者IDまたはパスワードが正しくありません．');
  }

  cache.remove(attemptKey);
  return {
    ok: true,
    participantId,
    allowedConditions: parseConditions_(participant.allowed_conditions),
    token: createSessionToken_(participantId),
    expiresInMinutes: CATCHERX_CONFIG.sessionMinutes,
    serverDate: Utilities.formatDate(new Date(), CATCHERX_CONFIG.timezone, 'yyyy-MM-dd')
  };
}

function submitResponse_(parameters) {
  const session = verifySessionToken_(String(parameters.token || ''));
  let payload;
  if (String(parameters.payload || '').length > 20000) {
    throw publicError_('回答データのサイズが上限を超えています．');
  }
  try {
    payload = JSON.parse(String(parameters.payload || '{}'));
  } catch (error) {
    throw publicError_('回答データの形式が正しくありません．');
  }

  const participant = findParticipant_(session.sub);
  if (!participant || !normalizeBoolean_(participant.active, false)) {
    throw publicError_('この参加者IDは現在利用できません．');
  }

  const allowedConditions = parseConditions_(participant.allowed_conditions);
  const condition = String(payload.condition || '');
  if (!allowedConditions.includes(condition)) {
    throw publicError_('この実験条件への回答は許可されていません．');
  }

  const validated = validateEvaluationPayload_(payload);
  const now = new Date();
  const recordedDate = Utilities.formatDate(now, CATCHERX_CONFIG.timezone, 'yyyy-MM-dd');
  const savedAt = Utilities.formatDate(now, CATCHERX_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.responseSheet, RESPONSE_HEADERS);
    const existing = getDataObjects_(sheet).some(row =>
      String(row.participant_id) === session.sub && String(row.condition) === condition
    );
    if (existing) {
      throw publicError_('この参加者IDでは，選択した実験条件への回答がすでに登録されています．');
    }

    sheet.appendRow([
      Utilities.getUuid(),
      session.sub,
      condition,
      safeSheetText_(validated.sessionLabel),
      recordedDate,
      savedAt,
      validated.tlxMethod,
      JSON.stringify(validated.tlxRatings),
      JSON.stringify(validated.tlxWeights),
      validated.tlxScore,
      JSON.stringify(validated.susResponses),
      validated.susScore,
      true
    ]);
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    participantId: session.sub,
    condition,
    recordedDate,
    message: '回答を受け付けました．'
  };
}

function validateEvaluationPayload_(payload) {
  const tlxMethod = payload.tlxMethod === 'weighted' ? 'weighted' : 'raw';
  const tlxKeys = ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration'];
  const ratings = {};
  const weights = {};

  tlxKeys.forEach(key => {
    if (!payload.tlxRatings || !Object.prototype.hasOwnProperty.call(payload.tlxRatings, key) ||
        !payload.tlxWeights || !Object.prototype.hasOwnProperty.call(payload.tlxWeights, key)) {
      throw publicError_('NASA-TLXの回答値が不足しています．');
    }
    const rating = Number(payload.tlxRatings && payload.tlxRatings[key]);
    const weight = Number(payload.tlxWeights && payload.tlxWeights[key]);
    if (!Number.isFinite(rating) || rating < 0 || rating > 100 || rating % 5 !== 0) {
      throw publicError_('NASA-TLXの回答値が正しくありません．');
    }
    if (!Number.isInteger(weight) || weight < 0 || weight > 5) {
      throw publicError_('NASA-TLXの重みが正しくありません．');
    }
    ratings[key] = rating;
    weights[key] = weight;
  });

  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (tlxMethod === 'weighted' && weightTotal !== 15) {
    throw publicError_('重み付きNASA-TLXの一対比較が完了していません．');
  }

  const susResponses = Array.isArray(payload.susResponses)
    ? payload.susResponses.map(Number)
    : [];
  if (susResponses.length !== 10 || susResponses.some(value => !Number.isInteger(value) || value < 1 || value > 5)) {
    throw publicError_('SUSの回答値が正しくありません．');
  }

  const rawTlx = Object.values(ratings).reduce((sum, value) => sum + value, 0) / 6;
  const weightedTlx = tlxKeys.reduce((sum, key) => sum + ratings[key] * weights[key], 0) / 15;
  const susContribution = susResponses.reduce((sum, response, index) =>
    sum + (index % 2 === 0 ? response - 1 : 5 - response), 0
  );

  return {
    sessionLabel: String(payload.sessionLabel || '').trim().slice(0, 32),
    tlxMethod,
    tlxRatings: ratings,
    tlxWeights: weights,
    tlxScore: tlxMethod === 'weighted' ? weightedTlx : rawTlx,
    susResponses,
    susScore: susContribution * 2.5
  };
}

function buildPublicSummary_() {
  const sheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.responseSheet, RESPONSE_HEADERS);
  const rows = getDataObjects_(sheet).filter(row => normalizeBoolean_(row.approved, false));
  const groups = new Map();

  rows.forEach(row => {
    const condition = String(row.condition || '');
    if (!groups.has(condition)) groups.set(condition, { tlx: [], sus: [] });
    groups.get(condition).tlx.push(Number(row.tlx_score));
    groups.get(condition).sus.push(Number(row.sus_score));
  });

  return Array.from(groups, ([condition, values]) => ({ condition, values }))
    .filter(group => group.values.tlx.length >= CATCHERX_CONFIG.minimumPublicGroupSize)
    .map(group => ({
      condition: group.condition,
      n: group.values.tlx.length,
      tlxMean: mean_(group.values.tlx),
      tlxSd: sampleSd_(group.values.tlx),
      susMean: mean_(group.values.sus),
      susSd: sampleSd_(group.values.sus)
    }));
}

function createSessionToken_(participantId) {
  const payload = base64Url_(JSON.stringify({
    sub: participantId,
    exp: Date.now() + CATCHERX_CONFIG.sessionMinutes * 60 * 1000,
    nonce: Utilities.getUuid()
  }));
  return `${payload}.${sign_(payload, 'SESSION_SECRET')}`;
}

function verifySessionToken_(token) {
  const parts = token.split('.');
  if (parts.length !== 2 || !timingSafeEqual_(sign_(parts[0], 'SESSION_SECRET'), parts[1])) {
    throw publicError_('認証の有効性を確認できません．再度ログインしてください．');
  }

  let payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (error) {
    throw publicError_('認証の有効性を確認できません．再度ログインしてください．');
  }
  if (!payload.sub || Number(payload.exp) < Date.now()) {
    throw publicError_('認証の有効期限が切れました．再度ログインしてください．');
  }
  return payload;
}

function findParticipant_(participantId) {
  const sheet = ensureSheet_(getSpreadsheet_(), CATCHERX_CONFIG.participantSheet, PARTICIPANT_HEADERS);
  return getDataObjects_(sheet).find(row => String(row.participant_id) === participantId) || null;
}

function parseConditions_(value) {
  const requested = String(value || '')
    .split('|')
    .map(item => item.trim())
    .filter(Boolean);
  const conditions = requested.length ? requested : CATCHERX_CONFIG.conditions;
  const invalid = conditions.filter(condition => !CATCHERX_CONFIG.conditions.includes(condition));
  if (invalid.length) throw new Error(`未定義の実験条件です: ${invalid.join(', ')}`);
  return [...new Set(conditions)];
}

function validateParticipantId_(participantId) {
  if (!/^[A-Za-z0-9_-]{2,24}$/.test(participantId)) {
    throw publicError_('参加者IDまたはパスワードが正しくありません．');
  }
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (actual.join('|') !== headers.join('|')) {
    throw new Error(`${name}シートの列見出しが想定と異なります．`);
  }
  return sheet;
}

function getDataObjects_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_IDが設定されていません．初期設定を実行してください．');
  return SpreadsheetApp.openById(id);
}

function hashPassword_(password, salt) {
  const pepper = requiredProperty_('PASSWORD_PEPPER');
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(`${salt}:${password}`, pepper)
  ).replace(/=+$/g, '');
}

function sign_(value, propertyName) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(value, requiredProperty_(propertyName))
  ).replace(/=+$/g, '');
}

function shortHash_(value) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
  ).replace(/=+$/g, '').slice(0, 20);
}

function base64Url_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, '');
}

function timingSafeEqual_(left, right) {
  const a = String(left);
  const b = String(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^
      (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  }
  return difference === 0;
}

function requiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(`${name}が設定されていません．`);
  return value;
}

function createSecret_() {
  return `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, '');
}

function normalizeBoolean_(value, fallback) {
  if (value === true || String(value).toLowerCase() === 'true' || String(value) === '1') return true;
  if (value === false || String(value).toLowerCase() === 'false' || String(value) === '0') return false;
  return fallback;
}

function safeSheetText_(value) {
  const text = String(value || '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function mean_(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd_(values) {
  if (values.length < 2) return null;
  const average = mean_(values);
  return Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / (values.length - 1));
}

function publicError_(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function postMessageOutput_(response) {
  const allowedOrigin = requiredProperty_('ALLOWED_ORIGIN');
  const payload = JSON.stringify(response).replace(/</g, '\\u003c');
  const origin = JSON.stringify(allowedOrigin).replace(/</g, '\\u003c');
  return HtmlService
    .createHtmlOutput(`<script>window.top.postMessage(${payload},${origin});</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
