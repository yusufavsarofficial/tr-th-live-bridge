let socket = null;
const AUTH_TOKEN_KEY = "pingle.auth.token";
const AUTH_PHONE_KEY = "pingle.auth.phone";
const AUTH_USER_ID_KEY = "pingle.auth.userId";
const AUTH_DISPLAY_NAME_KEY = "pingle.auth.displayName";

function getSavedToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || ""; }
function saveToken(token) { localStorage.setItem(AUTH_TOKEN_KEY, token); }
function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_PHONE_KEY);
  localStorage.removeItem(AUTH_USER_ID_KEY);
  localStorage.removeItem(AUTH_DISPLAY_NAME_KEY);
}

const authState = {
  screen: getSavedToken() ? "chat" : "phone",
  token: getSavedToken(),
  phone: localStorage.getItem(AUTH_PHONE_KEY) || "",
  userId: localStorage.getItem(AUTH_USER_ID_KEY) || "",
  displayName: localStorage.getItem(AUTH_DISPLAY_NAME_KEY) || "",
  isLoading: false,
  error: "",
};

async function apiPost(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  try {
    const r = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    return await r.json();
  } catch { return { ok: false, error: "Network error" }; }
}

async function apiGet(path, token) {
  try {
    const r = await fetch(path, { headers: { "Authorization": "Bearer " + token } });
    return await r.json();
  } catch { return { ok: false, error: "Network error" }; }
}

function connectSocket(token) {
  if (socket) socket.close();
  socket = io({
    autoConnect: true,
    transports: ["websocket", "polling"],
    auth: { token },
  });
  registerSocketHandlers(socket);
  return socket;
}

function initSocket() {
  if (!authState.token) return;
  connectSocket(authState.token);
}

const app = document.getElementById("app");
const toast = document.getElementById("toast");
const urlParams = new URLSearchParams(window.location.search);
const urlName = urlParams.get("name")?.trim() || "";
const urlAvatar = urlParams.get("avatar")?.trim() || "";
const storedName = localStorage.getItem("pingle.name") || "";
const hadStoredName = Boolean(storedName || urlName);
const storedLang = localStorage.getItem("pingle.lang") || "";
const urlLang = urlParams.get("lang") || "";
const initialLang = ["tr", "th"].includes(urlLang) ? urlLang : ["tr", "th"].includes(storedLang) ? storedLang : "tr";
const MAX_ATTACHMENT_BYTES = 900_000;
const MAX_IMAGE_EDGE = 1280;
const IMAGE_QUALITY = 0.72;

const i18n = {
  tr: {
    appName: "Nova",
    pageTitle: "Nova | Özel Sohbet",
    metaDescription: "Nova: özel iki kişilik mobil sohbet, otomatik Türkçe-Tayca çeviri ve arama deneyimi.",
    ready: "Hazır",
    genericError: "hata",
    connecting: "Bağlanıyor...",
    connected: "Görüşme bağlandı",
    chats: "Sohbetler",
    updates: "Durum",
    calls: "Aramalar",
    camera: "Kamera",
    profile: "Profil",
    search: "Ara",
    searchChat: "Sohbette ara",
    personalEncrypted: "Kişisel mesajlarınız uçtan uca şifrelidir",
    startProfile: "Sohbete başlamak için profilini bağla",
    defaultRoom: "Nova Odası",
    joinedReady: "Bağlanınca sohbet hazır",
    online: "çevrimiçi",
    roomOpen: "oda açık, davet bekliyor",
    now: "Şimdi",
    you: "Siz",
    guestName: "Misafir",
    typing: "{name} yazıyor...",
    roomRealChat: "Odadaki gerçek konuşma burada tutulur.",
    setupBanner: "Nova hazır. Odaya bağlanınca mesaj, çeviri ve arama açılır.",
    connectRoom: "Odaya bağlan",
    encryptedStrong: "Kişisel mesajlarınız uçtan uca şifrelidir",
    noStatusTitle: "Henüz durum yok",
    noStatusBody: "Gerçek kullanıcı durumları oluştuğunda burada görünür.",
    voiceCall: "Sesli ara",
    videoCall: "Görüntülü ara",
    callHistory: "Arama geçmişi",
    noCallsTitle: "Henüz arama yok",
    noCallsBody: "Gerçek görüşmeler başladıktan sonra geçmiş burada görünür.",
    startCall: "Arama başlat",
    newChat: "Yeni sohbet",
    mainTabs: "Ana sekmeler",
    setupTitle: "Profil ve oda",
    close: "Kapat",
    displayName: "Görünen ad",
    profilePhoto: "Profil resmi",
    profilePhotoHelp: "Galeriden seç, URL ile uğraşma.",
    choose: "Seç",
    language: "Dil",
    roomCode: "Oda kodu",
    roomPin: "Oda PIN",
    cancel: "Vazgeç",
    save: "Kaydet",
    connect: "Bağlan",
    privacyTitle: "Gizlilik ve güven",
    privacyP1: "Nova, iki kişi arasında özel ve kesintisiz iletişim için hazırlanmış bir mesajlaşma ve arama uygulamasıdır. Sohbet, sesli arama, görüntülü arama, medya paylaşımı ve Türkçe-Tayca çeviri tek sade arayüzde toplanır.",
    privacyP2: "Mesajlar, medya içerikleri ve arama sinyalleri yalnızca konuşmadaki kişiler için işlenir. Bildirimler, çağrılar ve çeviriler iletişimin hızlı, anlaşılır ve güvenilir kalması amacıyla kullanılır.",
    privacyP3: "Uygulama günlük kullanıma uygun olacak şekilde tasarlanmıştır: düşük veri tüketimi, net görüşme kalitesi, hızlı bildirimler, okunaklı sohbet ekranı ve gereksiz kalabalıktan uzak bir deneyim hedeflenir.",
    understood: "Anladım",
    realPeople: "Gerçek kişiler",
    personCount: "{count} kişi",
    activeRoom: "Nova odasında aktif",
    noOtherPerson: "Odada başka kişi yok",
    otherWillAppear: "Karşı taraf bağlandığında burada görünür.",
    back: "Geri",
    today: "Bugün",
    securityNotice: "Mesajlar ve aramalar uçtan uca şifrelidir. Yalnızca bu sohbetteki kişiler okuyabilir, dinleyebilir veya paylaşabilir.",
    moreInfo: "Daha fazla bilgi",
    noMessages: "Henüz mesaj yok. İlk mesajı yaz.",
    incomingVoice: "sesli arıyor",
    incomingVideo: "görüntülü arıyor",
    accept: "Kabul et",
    reject: "Reddet",
    expand: "Genişlet",
    shrink: "Küçült",
    unmute: "Sesi aç",
    mute: "Sessize al",
    disableCamera: "Kamerayı kapat",
    enableCamera: "Kamerayı aç",
    shareScreen: "Ekran paylaş",
    end: "Bitir",
    menu: "Menü",
    emojiSelect: "Emoji seç",
    emoji: "Emoji",
    remove: "Kaldır",
    recording: "Ses kaydı alınıyor",
    message: "Mesaj",
    file: "Dosya",
    send: "Gönder",
    filtersReady: "Filtreler hazır, oda sohbeti canlı.",
    visualReady: "Bu bölüm görsel olarak hazırlandı.",
    fileReadError: "Dosya okunamadı.",
    fileTooLarge: "Dosya büyük. İnternet az tükensin diye 900 KB sınırı var.",
    fileSelectError: "Dosya seçilemedi.",
    profileImageOnly: "Profil için resim seç.",
    profileTooLarge: "Profil resmi 900 KB altında olmalı.",
    profileSelectError: "Profil resmi seçilemedi.",
    nameRequired: "Lütfen görünen ad gir.",
    profileSaved: "Profil kaydedildi.",
    waitingConnection: "Bağlantı bekleniyor.",
    connectionError: "Bağlantı hatası",
    messageSendError: "Mesaj gönderilemedi.",
    audioTooLarge: "Ses kaydı büyük. Daha kısa kayıt gönder.",
    audioStartError: "Ses kaydı başlatılamadı: {error}",
    mediaPreparing: "Medya hazırlanıyor...",
    callStartError: "Arama başlatılamadı: {error}",
    voiceWaiting: "Sesli arama bekleniyor...",
    videoWaiting: "Görüntülü arama bekleniyor...",
    incomingAccepting: "Gelen arama kabul ediliyor...",
    callAnswerError: "Arama cevabı gönderilemedi: {error}",
    callConnecting: "Görüşme bağlanıyor...",
    callAcceptError: "Arama kabul hatası: {error}",
    callRejected: "Arama reddedildi",
    callEnded: "Arama sonlandırıldı",
    noCameraCall: "Bu aramada kamera yok.",
    screenShareError: "Ekran paylaşım hatası: {error}",
    connectionLost: "Bağlantı koptu, arama sonlandı",
    newMessage: "Yeni mesaj",
    incomingCallStatus: "Gelen arama var",
    incomingVoiceNotification: "Sesli arama geliyor",
    incomingVideoNotification: "Görüntülü arama geliyor",
    answerProcessError: "Cevap işleme hatası: {error}",
    callEndedShort: "Arama sonlandı",
    otherBusy: "Karşı taraf meşgul",
    otherDisconnected: "Karşı taraf bağlantısı kesildi",
    otherOffline: "Karşı taraf çevrimdışı.",
    callRinging: "Karşı tarafa bildirim gönderildi",
    callQueued: "Karşı taraf uygulamayı açınca arama düşecek",
    missedCall: "Cevapsız arama",
    offlineMessagesArrived: "Açık değilken gelen bildirimler alındı",
    mediaPermissionError: "Kamera/mikrofon izni verilmedi veya gerçek medya açılamadı.",
    micMuted: "Mikrofon kapalı",
    micOn: "Mikrofon açık",
    cameraOff: "Kamera kapalı",
    cameraOn: "Kamera açık",
    translationPending: "Çeviri hazırlanıyor",
    systemJoined: "{name} odaya katıldı.",
    systemLeft: "{name} odadan ayrıldı.",
    systemHistoryCleared: "Sohbet geçmişi temizlendi.",
    errorNameRequired: "Lütfen görünen ad gir.",
    errorNameInvalid: "Ad 2-24 karakter olmalı; harf, sayı, nokta, alt çizgi ve tire kullanılabilir.",
    errorRoomCodeInvalid: "Oda kodu geçersiz.",
    errorRoomPinInvalid: "Oda PIN geçersiz.",
    errorAlreadyJoined: "Zaten odaya bağlısınız.",
    errorRoomFull: "Oda dolu. En fazla 2 kişi katılabilir.",
    errorJoinFirst: "Önce odaya bağlan.",
    errorMessageEmpty: "Mesaj boş olamaz.",
    errorMessageLong: "Mesaj çok uzun. En fazla {max} karakter.",
  },
  th: {
    appName: "Nova",
    pageTitle: "Nova | แชตส่วนตัว",
    metaDescription: "Nova: แชตมือถือส่วนตัวสำหรับสองคน พร้อมแปลไทย-ตุรกีอัตโนมัติและการโทร",
    ready: "พร้อม",
    genericError: "ผิดพลาด",
    connecting: "กำลังเชื่อมต่อ...",
    connected: "เชื่อมต่อสายแล้ว",
    chats: "แชต",
    updates: "สถานะ",
    calls: "การโทร",
    camera: "กล้อง",
    profile: "โปรไฟล์",
    search: "ค้นหา",
    searchChat: "ค้นหาในแชต",
    personalEncrypted: "ข้อความส่วนตัวของคุณเข้ารหัสตั้งแต่ต้นทางถึงปลายทาง",
    startProfile: "เชื่อมต่อโปรไฟล์เพื่อเริ่มแชต",
    defaultRoom: "ห้อง Nova",
    joinedReady: "เชื่อมต่อแล้วแชตจะพร้อม",
    online: "ออนไลน์",
    roomOpen: "ห้องเปิดอยู่ รอคำเชิญ",
    now: "ตอนนี้",
    you: "คุณ",
    guestName: "ผู้เยี่ยมชม",
    typing: "{name} กำลังพิมพ์...",
    roomRealChat: "บทสนทนาจริงของห้องจะแสดงที่นี่",
    setupBanner: "Nova พร้อมแล้ว เมื่อเข้าห้องแล้วจะใช้ข้อความ แปลภาษา และการโทรได้",
    connectRoom: "เข้าห้อง",
    encryptedStrong: "ข้อความส่วนตัวของคุณเข้ารหัสตั้งแต่ต้นทางถึงปลายทาง",
    noStatusTitle: "ยังไม่มีสถานะ",
    noStatusBody: "สถานะของผู้ใช้จริงจะแสดงที่นี่เมื่อมีการสร้าง",
    voiceCall: "โทรเสียง",
    videoCall: "วิดีโอคอล",
    callHistory: "ประวัติการโทร",
    noCallsTitle: "ยังไม่มีการโทร",
    noCallsBody: "ประวัติจะปรากฏที่นี่หลังจากเริ่มการโทรจริง",
    startCall: "เริ่มโทร",
    newChat: "แชตใหม่",
    mainTabs: "แท็บหลัก",
    setupTitle: "โปรไฟล์และห้อง",
    close: "ปิด",
    displayName: "ชื่อที่แสดง",
    profilePhoto: "รูปโปรไฟล์",
    profilePhotoHelp: "เลือกจากแกลเลอรี ไม่ต้องใส่ URL",
    choose: "เลือก",
    language: "ภาษา",
    roomCode: "รหัสห้อง",
    roomPin: "PIN ห้อง",
    cancel: "ยกเลิก",
    save: "บันทึก",
    connect: "เชื่อมต่อ",
    privacyTitle: "ความเป็นส่วนตัวและความปลอดภัย",
    privacyP1: "Nova เป็นแอปสำหรับการสนทนาและการโทรส่วนตัวระหว่างสองคน รวมแชต การโทรเสียง วิดีโอคอล การส่งสื่อ และการแปลไทย-ตุรกีไว้ในหน้าจอที่ใช้งานง่าย",
    privacyP2: "ข้อความ สื่อ และสัญญาณการโทรถูกใช้เพื่อการสื่อสารของคนในบทสนทนานี้เท่านั้น การแจ้งเตือน การโทร และการแปลถูกออกแบบให้การสื่อสารรวดเร็ว ชัดเจน และเชื่อถือได้",
    privacyP3: "แอปออกแบบมาสำหรับการใช้งานจริงทุกวัน: ใช้ข้อมูลน้อย คุณภาพสายชัด แจ้งเตือนเร็ว อ่านแชตง่าย และไม่มีสิ่งรบกวนเกินจำเป็น",
    understood: "เข้าใจแล้ว",
    realPeople: "ผู้ใช้จริง",
    personCount: "{count} คน",
    activeRoom: "ออนไลน์ในห้อง Nova",
    noOtherPerson: "ยังไม่มีคนอื่นในห้อง",
    otherWillAppear: "อีกฝ่ายจะปรากฏที่นี่เมื่อเชื่อมต่อ",
    back: "กลับ",
    today: "วันนี้",
    securityNotice: "ข้อความและการโทรเข้ารหัสตั้งแต่ต้นทางถึงปลายทาง เฉพาะคนในแชตนี้เท่านั้นที่อ่าน ฟัง หรือแชร์ได้",
    moreInfo: "ข้อมูลเพิ่มเติม",
    noMessages: "ยังไม่มีข้อความ ลองส่งข้อความแรก",
    incomingVoice: "กำลังโทรเสียง",
    incomingVideo: "กำลังวิดีโอคอล",
    accept: "รับสาย",
    reject: "ปฏิเสธ",
    expand: "ขยาย",
    shrink: "ย่อ",
    unmute: "เปิดเสียง",
    mute: "ปิดเสียง",
    disableCamera: "ปิดกล้อง",
    enableCamera: "เปิดกล้อง",
    shareScreen: "แชร์หน้าจอ",
    end: "วางสาย",
    menu: "เมนู",
    emojiSelect: "เลือกอีโมจิ",
    emoji: "อีโมจิ",
    remove: "ลบ",
    recording: "กำลังบันทึกเสียง",
    message: "ข้อความ",
    file: "ไฟล์",
    send: "ส่ง",
    filtersReady: "ตัวกรองพร้อมแล้ว แชตห้องกำลังใช้งาน",
    visualReady: "ส่วนนี้เตรียมไว้สำหรับหน้าจอแล้ว",
    fileReadError: "อ่านไฟล์ไม่ได้",
    fileTooLarge: "ไฟล์ใหญ่เกินไป จำกัด 900 KB เพื่อลดการใช้อินเทอร์เน็ต",
    fileSelectError: "เลือกไฟล์ไม่ได้",
    profileImageOnly: "เลือกรูปสำหรับโปรไฟล์",
    profileTooLarge: "รูปโปรไฟล์ต้องต่ำกว่า 900 KB",
    profileSelectError: "เลือกรูปโปรไฟล์ไม่ได้",
    nameRequired: "กรุณาใส่ชื่อที่แสดง",
    profileSaved: "บันทึกโปรไฟล์แล้ว",
    waitingConnection: "กำลังรอการเชื่อมต่อ",
    connectionError: "เชื่อมต่อผิดพลาด",
    messageSendError: "ส่งข้อความไม่ได้",
    audioTooLarge: "ไฟล์เสียงใหญ่เกินไป กรุณาบันทึกให้สั้นลง",
    audioStartError: "เริ่มบันทึกเสียงไม่ได้: {error}",
    mediaPreparing: "กำลังเตรียมสื่อ...",
    callStartError: "เริ่มโทรไม่ได้: {error}",
    voiceWaiting: "กำลังรอสายเสียง...",
    videoWaiting: "กำลังรอวิดีโอคอล...",
    incomingAccepting: "กำลังรับสาย...",
    callAnswerError: "ส่งคำตอบสายไม่ได้: {error}",
    callConnecting: "กำลังเชื่อมต่อสาย...",
    callAcceptError: "รับสายไม่ได้: {error}",
    callRejected: "ปฏิเสธสายแล้ว",
    callEnded: "วางสายแล้ว",
    noCameraCall: "สายนี้ไม่มีกล้อง",
    screenShareError: "แชร์หน้าจอผิดพลาด: {error}",
    connectionLost: "การเชื่อมต่อหลุด สายสิ้นสุดแล้ว",
    newMessage: "ข้อความใหม่",
    incomingCallStatus: "มีสายเข้า",
    incomingVoiceNotification: "มีสายเสียงเข้า",
    incomingVideoNotification: "มีวิดีโอคอลเข้า",
    answerProcessError: "ประมวลผลคำตอบสายผิดพลาด: {error}",
    callEndedShort: "สายสิ้นสุดแล้ว",
    otherBusy: "อีกฝ่ายไม่ว่าง",
    otherDisconnected: "อีกฝ่ายตัดการเชื่อมต่อ",
    otherOffline: "อีกฝ่ายออฟไลน์",
    callRinging: "ส่งแจ้งเตือนไปยังอีกฝ่ายแล้ว",
    callQueued: "อีกฝ่ายจะได้รับสายเมื่อเปิดแอป",
    missedCall: "สายที่ไม่ได้รับ",
    offlineMessagesArrived: "ได้รับการแจ้งเตือนระหว่างออฟไลน์แล้ว",
    mediaPermissionError: "ไม่ได้รับอนุญาตกล้อง/ไมค์ หรือเปิดสื่อจริงไม่ได้",
    micMuted: "ปิดไมค์แล้ว",
    micOn: "เปิดไมค์แล้ว",
    cameraOff: "ปิดกล้องแล้ว",
    cameraOn: "เปิดกล้องแล้ว",
    translationPending: "กำลังแปล",
    systemJoined: "{name} เข้าห้องแล้ว",
    systemLeft: "{name} ออกจากห้องแล้ว",
    systemHistoryCleared: "ล้างประวัติแชตแล้ว",
    errorNameRequired: "กรุณาใส่ชื่อที่แสดง",
    errorNameInvalid: "ชื่อต้องมี 2-24 ตัวอักษร ใช้ตัวอักษร ตัวเลข จุด ขีดล่าง และขีดกลางได้",
    errorRoomCodeInvalid: "รหัสห้องไม่ถูกต้อง",
    errorRoomPinInvalid: "PIN ห้องไม่ถูกต้อง",
    errorAlreadyJoined: "คุณอยู่ในห้องแล้ว",
    errorRoomFull: "ห้องเต็ม เข้าร่วมได้สูงสุด 2 คน",
    errorJoinFirst: "กรุณาเข้าห้องก่อน",
    errorMessageEmpty: "ข้อความว่างไม่ได้",
    errorMessageLong: "ข้อความยาวเกินไป สูงสุด {max} ตัวอักษร",
  },
};

function loadCallLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem("pingle.callLog") || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

function saveCallLog() {
  try {
    localStorage.setItem("pingle.callLog", JSON.stringify(state.callLog.slice(0, 30)));
  } catch {}
}

const state = {
  lang: initialLang,
  activeTab: "chats",
  view: "home",
  setupOpen: false,
  joinError: "",
  search: "",
  filter: "all",
  joined: false,
  autoJoinAttempted: false,
  me: {
    name: urlName || storedName || authState.displayName,
    avatarUrl: urlAvatar || localStorage.getItem("pingle.avatar") || "",
  },
  persistProfile: !urlParams.has("noStore"),
  roomCode: urlParams.get("roomCode") || localStorage.getItem("pingle.roomCode") || "",
  roomPin: "",
  maxUsers: 2,
  maxMessageLength: 500,
  roomCodeRequired: false,
  roomPinRequired: false,
  users: [],
  history: [],
  systemMessages: [],
  callLog: loadCallLog(),
  typingName: "",
  draft: "",
  emojiOpen: false,
  infoOpen: false,
  pendingAttachment: null,
  recording: {
    active: false,
    recorder: null,
    chunks: [],
    startedAt: 0,
  },
  notificationPermissionAsked: false,
  windowFocused: true,
  connection: "offline",
  rtcIceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  call: {
    pc: null,
    localStream: null,
    remoteStream: null,
    pendingOffer: null,
    inCall: false,
    mode: null,
    isMuted: false,
    cameraEnabled: true,
    sharingScreen: false,
    minimized: false,
    localVideoPos: { x: 10, y: 10 },
    localFacingMode: "user",
    cameraTrack: null,
    screenTrack: null,
    status: i18n[initialLang].ready,
  },
};

document.documentElement.lang = state.lang;

let typingTimer;
let toastTimer;
let pushSubscribeInFlight = null;

function t(key, replacements = {}) {
  const table = i18n[state.lang] || i18n.tr;
  const fallback = i18n.tr[key] || key;
  return String(table[key] || fallback).replace(/\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : "",
  );
}

function setLanguage(lang) {
  state.lang = lang === "th" ? "th" : "tr";
  applyLanguageToDocument();
  localStorage.setItem("pingle.lang", state.lang);
  if (!state.call.inCall && !state.call.pendingOffer) {
    state.call.status = t("ready");
  }
  if (state.joined) {
    setupPushNotifications().catch(() => {});
  }
}

function applyLanguageToDocument() {
  document.documentElement.lang = state.lang;
  document.title = t("pageTitle");
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute("content", t("metaDescription"));
  }
}

function readableServerError(errorText) {
  const text = String(errorText || "");
  if (/other user is offline/i.test(text)) {
    return t("otherOffline");
  }
  if (/name is required/i.test(text)) {
    return t("errorNameRequired");
  }
  if (/name must be/i.test(text)) {
    return t("errorNameInvalid");
  }
  if (/invalid room code/i.test(text)) {
    return t("errorRoomCodeInvalid");
  }
  if (/invalid room pin/i.test(text)) {
    return t("errorRoomPinInvalid");
  }
  if (/already joined/i.test(text)) {
    return t("errorAlreadyJoined");
  }
  if (/room is full/i.test(text)) {
    return t("errorRoomFull");
  }
  if (/join first/i.test(text)) {
    return t("errorJoinFirst");
  }
  if (/message cannot be empty/i.test(text)) {
    return t("errorMessageEmpty");
  }
  const longMatch = text.match(/message too long.*max\s+(\d+)/i);
  if (longMatch) {
    return t("errorMessageLong", { max: longMatch[1] });
  }
  return text || t("genericError");
}

applyLanguageToDocument();

const tabs = [
  { id: "chats", labelKey: "chats", icon: "message-square" },
  { id: "updates", labelKey: "updates", icon: "status" },
  { id: "calls", labelKey: "calls", icon: "phone" },
];

const emojiGroups = [
  "😀", "😃", "😄", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩",
  "😢", "😭", "😡", "😴", "🤔", "🙈", "🙏", "👍", "👎", "👏", "🤝", "💪",
  "❤️", "💚", "💙", "🔥", "🎉", "🌹", "☕", "🍀", "🌙", "⭐", "✅", "📞",
  "📷", "🎤", "📎", "🇹🇷", "🇹🇭",
];

const iconPaths = {
  "archive": '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
  "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  "back": '<path d="m15 18-6-6 6-6"/><path d="M21 12H9"/>',
  "calendar": '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/>',
  "camera": '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
  "check": '<path d="m20 6-11 11-5-5"/>',
  "close": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "download": '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  "edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
  "emoji": '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  "heart": '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
  "image": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m21 15-5-5L5 21"/><path d="M8.5 9.5h.01"/>',
  "keypad": '<path d="M6 6h.01M12 6h.01M18 6h.01M6 12h.01M12 12h.01M18 12h.01M6 18h.01M12 18h.01M18 18h.01"/>',
  "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>',
  "maximize": '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  "menu": '<path d="M12 7h.01"/><path d="M12 12h.01"/><path d="M12 17h.01"/>',
  "minimize": '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  "message-square": '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>',
  "mic": '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  "mic-off": '<path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1"/><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3"/><path d="M19 10v2a7 7 0 0 1-1.7 4.6"/><path d="M5 10v2a7 7 0 0 0 10.5 6"/><path d="M12 19v3"/>',
  "paperclip": '<path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 1 1 5.7 5.7L10 17.4a2 2 0 1 1-2.8-2.8l8.5-8.5"/>',
  "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z"/>',
  "phone-plus": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z"/><path d="M16 2v6"/><path d="M13 5h6"/>',
  "plus": '<path d="M12 5v14"/><path d="M5 12h14"/>',
  "qr": '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h.01M18 14h2v2M14 18h2v2M20 20h.01"/>',
  "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  "send": '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
  "status": '<path d="M4 12a8 8 0 0 1 8-8"/><path d="M20 12a8 8 0 0 1-8 8"/><path d="M7.5 5.2A8 8 0 0 1 18.8 8.5"/><path d="M16.5 18.8A8 8 0 0 1 5.2 15.5"/><circle cx="12" cy="12" r="3"/>',
  "stop": '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  "trash": '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/>',
  "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M16 11h6"/>',
  "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  "video": '<path d="M15 10 21 6v12l-6-4v-4Z"/><rect x="3" y="6" width="12" height="12" rx="2"/>',
};

function icon(name, size = 24) {
  const body = iconPaths[name] || iconPaths["message-square"];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {}
  return "";
}

function initials(name) {
  const source = String(name || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function colorForName(name) {
  const colors = [
    "linear-gradient(135deg,#6256ff,#19c3a0)",
    "linear-gradient(135deg,#ff7a59,#ffd166)",
    "linear-gradient(135deg,#ef476f,#7b2cbf)",
    "linear-gradient(135deg,#0ead69,#2a9d8f)",
    "linear-gradient(135deg,#f72585,#4cc9f0)",
    "linear-gradient(135deg,#6d597a,#e56b6f)",
  ];
  const text = String(name || "");
  const total = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[total % colors.length];
}

function avatar(user, size = "") {
  const name = user?.name || user?.initials || "?";
  const url = safeUrl(user?.avatarUrl);
  const sizeClass = size ? ` ${size}` : "";
  const fallback = escapeHtml(user?.initials || initials(name));
  const style = `background:${colorForName(name)}`;
  if (url) {
    return `<span class="avatar${sizeClass}" style="${style}"><img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" /></span>`;
  }
  return `<span class="avatar${sizeClass}" style="${style}">${fallback}</span>`;
}

function formatTime(timestamp) {
  return new Date(timestamp || Date.now()).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeMessageText(item) {
  const sourceLang = item.sourceLang === "th" ? "th" : "tr";
  const preferredLang = state.lang === "th" ? "th" : "tr";
  const secondaryLang = preferredLang === "th" ? "tr" : "th";
  const trText = item.trText || (sourceLang === "tr" ? item.text : "") || "";
  const thText = item.thText || (sourceLang === "th" ? item.text : "") || "";
  const preferredText = preferredLang === "th" ? thText : trText;
  const fallbackText = item.primaryText || item.text || "";
  const primaryLang = preferredText ? preferredLang : item.primaryLang || sourceLang;
  const primaryText = preferredText || fallbackText;
  const secondaryText = secondaryLang === "th" ? thText : trText;
  return { primaryLang, secondaryLang, primaryText, secondaryText };
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderAttachment(attachment) {
  if (!attachment) {
    return "";
  }

  const name = escapeHtml(attachment.name || "dosya");
  const meta = escapeHtml(formatBytes(attachment.size));

  if (attachment.kind === "image") {
    return `
      <a class="attachment image-attachment" href="${escapeHtml(attachment.dataUrl)}" download="${name}">
        <img src="${escapeHtml(attachment.dataUrl)}" alt="${name}" />
        <span>${name} · ${meta}</span>
      </a>
    `;
  }

  if (attachment.kind === "audio") {
    return `
      <div class="attachment audio-attachment">
        <audio controls preload="metadata" src="${escapeHtml(attachment.dataUrl)}"></audio>
        <span>${name} · ${meta}</span>
      </div>
    `;
  }

  return `
    <a class="attachment file-attachment" href="${escapeHtml(attachment.dataUrl)}" download="${name}">
      ${icon("paperclip", 22)}
      <span>${name}<small>${meta}</small></span>
    </a>
  `;
}

function roomTitle() {
  const other = state.users.find((user) => user.name !== state.me.name);
  return other?.name || t("defaultRoom");
}

function roomSubtitle() {
  if (state.typingName) {
    return t("typing", { name: state.typingName });
  }
  if (!state.joined) {
    return t("joinedReady");
  }
  const count = state.users.length || 1;
  return count > 1 ? t("online") : t("roomOpen");
}

function latestChatMessage() {
  return [...state.history].reverse().find((item) => item && !item.type);
}

function otherUserName() {
  return state.users.find((user) => user.name && user.name !== state.me.name)?.name || t("otherOffline");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2400);
}

async function requestNotificationPermission() {
  if (!("Notification" in window) || state.notificationPermissionAsked) {
    return "Notification" in window ? Notification.permission : "unsupported";
  }
  state.notificationPermissionAsked = true;
  if (Notification.permission === "default") {
    return Notification.requestPermission().catch(() => "denied");
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function setupPushNotifications() {
  if (pushSubscribeInFlight) {
    return pushSubscribeInFlight;
  }
  if (!state.joined || !state.me.name || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  pushSubscribeInFlight = (async () => {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return null;
    }

    const response = await fetch("/api/notifications/config", { method: "GET" });
    if (!response.ok) {
      return null;
    }
    const config = await response.json();
    if (!config?.publicKey) {
      return null;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
    }

    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.me.name,
        lang: state.lang,
        subscription: subscription.toJSON(),
      }),
    });
    return subscription;
  })().finally(() => {
    pushSubscribeInFlight = null;
  });

  return pushSubscribeInFlight;
}

function notifyUser(title, body, tag = "pingle") {
  showToast(`${title}: ${body}`.slice(0, 130));
  if ("vibrate" in navigator) {
    navigator.vibrate([120, 80, 120]);
  }
  if (window.PingleAndroid && typeof window.PingleAndroid.notify === "function") {
    try {
      window.PingleAndroid.notify(String(title || t("appName")), String(body || ""), String(tag || "pingle"));
      return;
    } catch {}
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  const notification = new Notification(title, {
    body,
    tag,
    silent: false,
  });
  setTimeout(() => notification.close(), 5000);
}

function addCallLog(entry) {
  const next = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    name: entry.name || t("appName"),
    mode: entry.mode === "voice" ? "voice" : "video",
    direction: entry.direction || "outgoing",
    status: entry.status || "completed",
  };
  state.callLog = [next, ...state.callLog].slice(0, 30);
  saveCallLog();
}

function renderHeader() {
  const titles = {
    chats: t("appName"),
    updates: t("updates"),
    calls: t("calls"),
  };
  const isChats = state.activeTab === "chats";
  const actions = isChats
    ? `
      <button class="icon-btn" type="button" data-action="open-thread" title="${t("camera")}">${icon("camera")}</button>
      <button class="icon-btn" type="button" data-action="open-setup" title="${t("profile")}">${icon("menu")}</button>
    `
    : `
      <button class="icon-btn" type="button" data-action="focus-search" title="${t("search")}">${icon("search")}</button>
      <button class="icon-btn" type="button" data-action="open-setup" title="${t("profile")}">${icon("menu")}</button>
    `;

  const search = `
        <label class="search-bar" for="searchInput">
          ${icon("search", 24)}
          <input id="searchInput" value="${escapeHtml(state.search)}" placeholder="${t("searchChat")}" autocomplete="off" />
        </label>
      `;

  const filters = "";
  const titleMarkup = isChats
    ? `<h1 class="brand-title"><img class="brand-logo" src="/assets/nova-logo.svg" alt="" /> <span>${titles[state.activeTab]}</span></h1>`
    : `<h1 class="page-title">${titles[state.activeTab]}</h1>`;

  return `
    <header class="app-header">
      <div class="top-row">
        ${titleMarkup}
        <div class="head-actions">${actions}</div>
      </div>
      ${search}
      ${filters}
    </header>
  `;
}

function renderChatRow() {
  const last = latestChatMessage();
  const normalized = last ? normalizeMessageText(last) : null;
  const subtitle = state.typingName
    ? t("typing", { name: state.typingName })
    : normalized
      ? `${last.from === state.me.name ? t("you") : last.from}: ${normalized.primaryText}`
      : state.joined
        ? t("personalEncrypted")
        : t("startProfile");
  const time = last ? formatTime(last.timestamp) : t("now");
  const liveAvatar =
    state.users.find((user) => user.name !== state.me.name) ||
    state.users.find((user) => user.name === state.me.name) ||
    state.me;

  return `
    <button class="chat-row" type="button" data-action="open-thread">
      ${avatar(liveAvatar)}
      <span class="row-main">
        <span class="row-title-line">
          <span class="row-title">${escapeHtml(roomTitle())}</span>
        </span>
        <span class="row-subtitle">${escapeHtml(subtitle)}</span>
      </span>
      <span class="row-meta">
        <span class="${last ? "ok" : ""}">${escapeHtml(time)}</span>
        ${state.joined ? `<span class="unread-pill">${Math.max(1, state.users.length || 1)}</span>` : ""}
      </span>
    </button>
  `;
}

function renderChats() {
  return `
    <div class="chat-list">
      ${renderChatRow()}
    </div>
    ${
      state.joined
        ? `<p class="empty-note">${t("roomRealChat")}</p>`
        : `
          <div class="setup-inline">
            <div class="setup-banner">
              <p>${t("setupBanner")}</p>
              <button class="primary-btn" type="button" data-action="open-setup">${t("connectRoom")}</button>
            </div>
          </div>
        `
    }
    <div class="encrypted-line">${icon("lock", 14)} <span>${t("encryptedStrong")}</span></div>
  `;
}

function renderUpdates() {
  return `
    <div class="section-title-row">
      <h2>${t("updates")}</h2>
    </div>
    <div class="empty-tab">
      <span class="empty-icon">${icon("status", 30)}</span>
      <strong>${t("noStatusTitle")}</strong>
      <span>${t("noStatusBody")}</span>
    </div>
  `;
}

function renderCalls() {
  const rows = state.callLog
    .map((item) => {
      const isMissed = item.status === "missed" || item.status === "queued";
      const dirSymbol = item.direction === "incoming" ? "↙" : "↗";
      const statusText =
        item.status === "missed"
          ? t("missedCall")
          : item.status === "queued"
            ? t("callQueued")
            : item.mode === "voice"
              ? t("voiceCall")
              : t("videoCall");
      return `
        <button class="call-row" type="button" data-action="${item.mode === "voice" ? "voice-call" : "video-call"}">
          ${avatar({ name: item.name })}
          <span class="row-main">
            <span class="row-title-line">
              <strong class="row-title">${escapeHtml(item.name)}</strong>
            </span>
            <span class="row-subtitle"><span class="call-dir ${isMissed ? "missed" : ""}">${dirSymbol}</span> ${escapeHtml(statusText)} · ${formatTime(item.timestamp)}</span>
          </span>
          ${icon(item.mode === "voice" ? "phone" : "video", 24)}
        </button>
      `;
    })
    .join("");
  return `
    <div class="calls-quick real-actions">
      <button class="quick-action" type="button" data-action="voice-call"><span>${icon("phone", 28)}</span><span>${t("voiceCall")}</span></button>
      <button class="quick-action" type="button" data-action="video-call"><span>${icon("video", 28)}</span><span>${t("videoCall")}</span></button>
    </div>
    <div class="section-title-row">
      <h2>${t("callHistory")}</h2>
    </div>
    ${
      rows
        ? `<div class="call-list">${rows}</div>`
        : `<div class="empty-tab compact">
            <span class="empty-icon">${icon("phone", 28)}</span>
            <strong>${t("noCallsTitle")}</strong>
            <span>${t("noCallsBody")}</span>
          </div>`
    }
  `;
}

function renderActiveTab() {
  if (state.activeTab === "updates") {
    return renderUpdates();
  }
  if (state.activeTab === "calls") {
    return renderCalls();
  }
  return renderChats();
}

function renderFab() {
  if (state.activeTab === "calls") {
    return `<div class="fab-column"><button class="fab" type="button" data-action="voice-call" title="${t("startCall")}">${icon("phone-plus", 28)}</button></div>`;
  }
  if (state.activeTab === "chats") {
    return `<div class="fab-column"><button class="fab" type="button" data-action="open-contacts" title="${t("newChat")}">${icon("message-square", 28)}</button></div>`;
  }
  return "";
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav" aria-label="${t("mainTabs")}">
      ${tabs
        .map(
          (tab) => `
            <button class="nav-btn ${state.activeTab === tab.id ? "is-active" : ""}" type="button" data-tab="${tab.id}">
              <span class="nav-icon">${icon(tab.icon, 26)}</span>
              <span class="nav-label">${t(tab.labelKey)}</span>
            </button>
          `,
        )
        .join("")}
    </nav>
  `;
}

function renderSetupSheet() {
  return `
    <div class="sheet-backdrop" data-action="close-setup"></div>
    <section class="setup-sheet" aria-labelledby="setupTitle">
      <div class="sheet-head">
        <h2 id="setupTitle">${t("setupTitle")}</h2>
        <button class="icon-btn" type="button" data-action="close-setup" title="${t("close")}">${icon("close", 24)}</button>
      </div>
      <form class="setup-form" id="setupForm" novalidate>
        <div class="form-row">
          <label for="nameInput">${t("displayName")}</label>
          <input id="nameInput" name="name" maxlength="24" value="${escapeHtml(state.me.name)}" autocomplete="nickname" required />
        </div>
        <div class="profile-picker">
          ${avatar(state.me, "small")}
          <div>
            <strong>${t("profilePhoto")}</strong>
            <span>${t("profilePhotoHelp")}</span>
          </div>
          <button class="secondary-btn" type="button" data-action="pick-profile-photo">${t("choose")}</button>
        </div>
        <input id="avatarInput" name="avatar" type="hidden" value="${escapeHtml(state.me.avatarUrl)}" />
        <input id="profileFileInput" class="hidden" type="file" accept="image/*" />
        <div class="form-row">
          <label>${t("language")}</label>
          <div class="segmented-control" role="group" aria-label="${t("language")}">
            <button class="${state.lang === "tr" ? "is-active" : ""}" type="button" data-action="set-lang" data-lang="tr">TR</button>
            <button class="${state.lang === "th" ? "is-active" : ""}" type="button" data-action="set-lang" data-lang="th">ไทย</button>
          </div>
        </div>
        ${
          state.roomCodeRequired
            ? `
              <div class="form-row">
                <label for="roomCodeInput">${t("roomCode")}</label>
                <input id="roomCodeInput" name="roomCode" maxlength="64" value="${escapeHtml(state.roomCode)}" autocomplete="one-time-code" required />
              </div>
            `
            : ""
        }
        ${
          state.roomPinRequired
            ? `
              <div class="form-row">
                <label for="roomPinInput">${t("roomPin")}</label>
                <input id="roomPinInput" name="roomPin" maxlength="32" value="${escapeHtml(state.roomPin)}" autocomplete="one-time-code" inputmode="numeric" required />
              </div>
            `
            : ""
        }
        <p class="form-error" id="joinError">${escapeHtml(state.joinError)}</p>
        <div class="form-actions">
          <button class="secondary-btn" type="button" data-action="close-setup">${t("cancel")}</button>
          <button class="primary-btn" type="submit">${state.joined ? t("save") : t("connect")}</button>
        </div>
      </form>
    </section>
  `;
}

function renderInfoModal() {
  return `
    <div class="sheet-backdrop" data-action="close-info"></div>
    <section class="info-modal" aria-labelledby="infoTitle">
      <div class="sheet-head">
        <h2 id="infoTitle">${t("privacyTitle")}</h2>
        <button class="icon-btn" type="button" data-action="close-info" title="${t("close")}">${icon("close", 24)}</button>
      </div>
      <p>${t("privacyP1")}</p>
      <p>${t("privacyP2")}</p>
      <p>${t("privacyP3")}</p>
      <button class="primary-btn" type="button" data-action="close-info">${t("understood")}</button>
    </section>
  `;
}

// ─── Auth Screens ─────────────────────────────────────

function renderPhoneScreen() {
  return `
    <section class="auth-screen">
      <div class="auth-container">
        <h1 class="auth-logo">Nova</h1>
        <p class="auth-subtitle">Telefon numaranızı girin</p>
        <div class="auth-form">
          <input id="phoneInput" class="auth-input" type="tel" placeholder="+90 555 123 45 67" value="${escapeHtml(authState.phone)}" maxlength="15" autocomplete="tel" />
          ${authState.error ? `<p class="auth-error">${escapeHtml(authState.error)}</p>` : ""}
          <button class="primary-btn auth-btn" id="sendOtpBtn" ${authState.isLoading ? "disabled" : ""}>
            ${authState.isLoading ? '⏳' : 'OTP Gönder'}
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderOtpScreen() {
  return `
    <section class="auth-screen">
      <div class="auth-container">
        <h1 class="auth-logo">Nova</h1>
        <p class="auth-subtitle">${escapeHtml(authState.phone)} numarasına gönderilen kodu girin</p>
        <div class="auth-form">
          <input id="otpInput" class="auth-input otp-input" type="text" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code" />
          ${authState.error ? `<p class="auth-error">${escapeHtml(authState.error)}</p>` : ""}
          <button class="primary-btn auth-btn" id="verifyOtpBtn" ${authState.isLoading ? "disabled" : ""}>
            ${authState.isLoading ? '⏳' : 'Doğrula'}
          </button>
          <button class="text-btn" id="resendOtpBtn">Kodu tekrar gönder</button>
        </div>
      </div>
    </section>
  `;
}

function renderProfileScreen() {
  return `
    <section class="auth-screen">
      <div class="auth-container">
        <div class="auth-avatar">${(authState.displayName || "?").charAt(0).toUpperCase()}</div>
        <h1 class="auth-logo" style="font-size:22px">Profilinizi oluşturun</h1>
        <div class="auth-form">
          <input id="nameInput" class="auth-input" type="text" placeholder="Adınız" value="${escapeHtml(authState.displayName)}" maxlength="30" autocomplete="name" />
          <input id="aboutInput" class="auth-input" type="text" placeholder="Durum (opsiyonel)" maxlength="80" />
          ${authState.error ? `<p class="auth-error">${escapeHtml(authState.error)}</p>` : ""}
          <button class="primary-btn auth-btn" id="saveProfileBtn" ${authState.isLoading ? "disabled" : ""}>
            ${authState.isLoading ? '⏳' : 'Kaydet ve Başla'}
          </button>
        </div>
      </div>
    </section>
  `;
}

function bindAuthUI() {
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
      const phone = document.getElementById("phoneInput")?.value?.trim() || "";
      if (phone.replace(/\D/g, "").length < 7) { authState.error = "Geçerli bir telefon numarası girin"; render(); return; }
      authState.isLoading = true; authState.error = ""; render();
      const res = await apiPost("/api/v1/auth/otp/request", { phoneNumber: phone });
      authState.isLoading = false;
      if (res.ok) { authState.phone = phone; authState.error = ""; authState.screen = "otp"; render(); }
      else { authState.error = res.error || "Hata"; render(); }
    });
  }
  const verifyOtpBtn = document.getElementById("verifyOtpBtn");
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener("click", async () => {
      const otp = document.getElementById("otpInput")?.value?.trim() || "";
      if (otp.length !== 6) { authState.error = "6 haneli kodu girin"; render(); return; }
      authState.isLoading = true; authState.error = ""; render();
      const res = await apiPost("/api/v1/auth/otp/verify", { phoneNumber: authState.phone, otp });
      authState.isLoading = false;
      if (res.ok) {
        authState.token = res.token;
        authState.userId = res.user?.id || "";
        authState.displayName = res.user?.displayName || "";
        saveToken(res.token);
        localStorage.setItem(AUTH_PHONE_KEY, authState.phone);
        localStorage.setItem(AUTH_USER_ID_KEY, authState.userId);
        if (res.user?.displayName) {
          localStorage.setItem(AUTH_DISPLAY_NAME_KEY, res.user.displayName);
          localStorage.setItem("pingle.name", res.user.displayName);
          state.me.name = res.user.displayName;
          authState.screen = "chat"; render(); initSocket();
        } else {
          authState.screen = "profile"; render();
        }
      } else { authState.error = res.error || "Hata"; render(); }
    });
  }
  const resendOtpBtn = document.getElementById("resendOtpBtn");
  if (resendOtpBtn) {
    resendOtpBtn.addEventListener("click", async () => {
      authState.isLoading = true; authState.error = ""; render();
      const res = await apiPost("/api/v1/auth/otp/request", { phoneNumber: authState.phone });
      authState.isLoading = false;
      if (!res.ok) { authState.error = res.error || "Hata"; render(); }
    });
  }
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      const name = document.getElementById("nameInput")?.value?.trim() || "";
      const about = document.getElementById("aboutInput")?.value?.trim() || "";
      if (name.length < 2) { authState.error = "Ad en az 2 karakter olmalı"; render(); return; }
      authState.isLoading = true; authState.error = ""; render();
      const res = await apiPost("/api/v1/auth/profile", { displayName: name, about }, authState.token);
      authState.isLoading = false;
      if (res.ok) {
        authState.displayName = name;
        localStorage.setItem(AUTH_DISPLAY_NAME_KEY, name);
        localStorage.setItem("pingle.name", name);
        state.me.name = name;
        authState.screen = "chat"; render(); initSocket();
      } else { authState.error = res.error || "Hata"; render(); }
    });
  }
  document.querySelectorAll(".auth-input").forEach(input => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const btn = document.querySelector(".auth-btn");
        if (btn) btn.click();
      }
    });
  });
}

function renderAuth() {
  if (authState.screen === "phone") { app.innerHTML = renderPhoneScreen(); bindAuthUI(); }
  else if (authState.screen === "otp") { app.innerHTML = renderOtpScreen(); bindAuthUI(); }
  else if (authState.screen === "profile") { app.innerHTML = renderProfileScreen(); bindAuthUI(); }
}

function renderHome() {
  return `
    <section class="home-screen">
      ${renderHeader()}
      <div class="home-scroll">${renderActiveTab()}</div>
      ${renderFab()}
      ${renderBottomNav()}
      ${state.setupOpen ? renderSetupSheet() : ""}
      ${state.infoOpen ? renderInfoModal() : ""}
    </section>
  `;
}

function renderContactScreen() {
  const rows = state.users.filter((user) => user.name !== state.me.name).map((user) => ({
    name: user.name,
    subtitle: t("activeRoom"),
    avatarUrl: user.avatarUrl,
    initials: initials(user.name),
    live: true,
  }));
  return `
    <section class="contact-screen">
      <header class="contact-head">
        <button class="icon-btn" type="button" data-action="home" title="${t("back")}">${icon("back", 28)}</button>
        <span class="contact-title">
          <strong>${t("realPeople")}</strong>
          <span>${t("personCount", { count: rows.length })}</span>
        </span>
        <button class="icon-btn" type="button" data-action="focus-contact-search" title="${t("search")}">${icon("search", 27)}</button>
        <button class="icon-btn" type="button" data-action="open-setup" title="${t("profile")}">${icon("menu", 26)}</button>
      </header>
      <div class="contact-list">
        ${
          rows.length
            ? rows
                .map(
                  (item) => `
                    <button class="contact-row" type="button" data-action="open-thread">
                      ${avatar(item)}
                      <span class="row-main">
                        <span class="row-title">${escapeHtml(item.name)}</span>
                        <span class="row-subtitle">${escapeHtml(item.subtitle || "")}</span>
                      </span>
                      <span></span>
                    </button>
                  `,
                )
                .join("")
            : `
              <div class="empty-tab compact">
                <span class="empty-icon">${icon("users", 28)}</span>
                <strong>${t("noOtherPerson")}</strong>
                <span>${t("otherWillAppear")}</span>
              </div>
            `
        }
      </div>
      ${state.setupOpen ? renderSetupSheet() : ""}
      ${state.infoOpen ? renderInfoModal() : ""}
    </section>
  `;
}

function systemMessageText(item) {
  if (item?.key && i18n.tr[item.key]) {
    return t(item.key, item.vars || {});
  }
  return item?.text || "";
}

function renderMessageItem(item) {
  if (item.type === "system") {
    return `<div class="system-bubble">${escapeHtml(systemMessageText(item))} · ${formatTime(item.timestamp)}</div>`;
  }

  const mine = item.from === state.me.name;
  const normalized = normalizeMessageText(item);
  return `
    <div class="bubble-row ${mine ? "mine" : ""}">
      <article class="bubble">
        ${mine ? "" : `<div class="bubble-from">${escapeHtml(item.from)}</div>`}
        ${item.attachment ? renderAttachment(item.attachment) : ""}
        ${normalized.primaryText ? `<div class="bubble-text">${escapeHtml(normalized.primaryText)}</div>` : ""}
        ${
          normalized.secondaryText && normalized.secondaryText !== normalized.primaryText
            ? `<div class="translation-line"><span>${escapeHtml(normalized.secondaryLang.toUpperCase())}</span>${escapeHtml(normalized.secondaryText)}</div>`
            : item.translationPending && normalized.primaryText
              ? `<div class="translation-line is-pending"><span>...</span>${t("translationPending")}</div>`
            : ""
        }
        <div class="bubble-meta"><span>${formatTime(item.timestamp)}</span><span>${mine ? "✓✓" : ""}</span></div>
      </article>
    </div>
  `;
}

function renderMessages() {
  const items = [...state.history].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return `
    <div class="message-list" id="messageList">
      <div class="date-pill">${t("today")}</div>
      <div class="security-card">${icon("lock", 14)} ${t("securityNotice")} <button type="button" data-action="open-info">${t("moreInfo")}</button></div>
      ${
        items.length
          ? items.map(renderMessageItem).join("")
          : `<div class="system-bubble">${t("noMessages")}</div>`
      }
      ${state.typingName ? `<div class="system-bubble">${escapeHtml(t("typing", { name: state.typingName }))}</div>` : ""}
    </div>
  `;
}

function renderCallDock() {
  const showDock = state.call.inCall || state.call.pendingOffer;
  if (!showDock) {
    return "";
  }
  const isCompact = state.call.minimized;
  const hasVideoTracks =
    state.call.mode !== "voice" &&
    (Boolean(state.call.localStream?.getVideoTracks().length) ||
      Boolean(state.call.remoteStream?.getVideoTracks().length));
  const incoming = state.call.pendingOffer
    ? `
      <div class="incoming-call">
        <strong>${escapeHtml(state.call.pendingOffer.from?.name || t("otherOffline"))} ${state.call.pendingOffer.mode === "voice" ? t("incomingVoice") : t("incomingVideo")}</strong>
        <div class="incoming-actions">
          <button class="icon-btn success" type="button" data-action="accept-call" title="${t("accept")}">${icon("phone", 24)}</button>
          <button class="icon-btn danger" type="button" data-action="reject-call" title="${t("reject")}">${icon("close", 24)}</button>
        </div>
      </div>
    `
    : "";
  return `
    <section class="call-dock ${isCompact ? "is-compact" : ""}">
      <div class="call-topline">
        <span>${icon(state.call.mode === "voice" ? "phone" : "video", 18)} ${escapeHtml(state.call.status)}</span>
        <button class="icon-btn" type="button" data-action="toggle-call-size" title="${isCompact ? t("expand") : t("shrink")}">${icon(isCompact ? "maximize" : "minimize", 20)}</button>
      </div>
      <div class="call-video-stage ${!isCompact && hasVideoTracks ? "is-active" : ""}">
        <video id="remoteVideo" class="remote-video" autoplay playsinline></video>
        <video id="localVideo" class="local-video" autoplay playsinline muted style="right:${state.call.localVideoPos.x}px; bottom:${state.call.localVideoPos.y}px"></video>
      </div>
      ${incoming}
      ${
        state.call.inCall
          ? `
            <div class="call-controls">
              <button class="icon-btn ${state.call.isMuted ? "is-active" : ""}" type="button" data-action="toggle-mute" title="${state.call.isMuted ? t("unmute") : t("mute")}">${icon(state.call.isMuted ? "mic-off" : "mic", 22)}</button>
              <button class="icon-btn ${state.call.cameraEnabled ? "" : "is-active"}" type="button" data-action="toggle-camera" title="${state.call.cameraEnabled ? t("disableCamera") : t("enableCamera")}">${icon("camera", 22)}</button>
              <button class="icon-btn ${state.call.sharingScreen ? "is-active" : ""}" type="button" data-action="toggle-share" title="${t("shareScreen")}">${icon("image", 22)}</button>
              <button class="icon-btn danger" type="button" data-action="end-call" title="${t("end")}">${icon("phone", 22)}</button>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderThread() {
  const title = roomTitle();
  return `
    <section class="thread-screen">
      <header class="thread-head">
        <button class="icon-btn" type="button" data-action="home" title="${t("back")}">${icon("back", 29)}</button>
        <button class="thread-person" type="button" data-action="open-setup">
          ${avatar(state.users.find((user) => user.name !== state.me.name) || state.me, "small")}
          <span class="thread-name">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(roomSubtitle())}</span>
          </span>
        </button>
        <span class="thread-actions">
          <button class="icon-btn" type="button" data-action="video-call" title="${t("videoCall")}">${icon("video", 27)}</button>
          <button class="icon-btn" type="button" data-action="voice-call" title="${t("voiceCall")}">${icon("phone", 25)}</button>
          <button class="icon-btn" type="button" data-action="open-setup" title="${t("menu")}">${icon("menu", 25)}</button>
        </span>
      </header>
      <div class="messages-pane" id="messagesPane">${renderMessages()}</div>
      ${renderCallDock()}
      <form class="composer" id="messageForm" autocomplete="off">
        ${
          state.emojiOpen
            ? `
              <div class="emoji-panel" aria-label="${t("emojiSelect")}">
                ${emojiGroups
                  .map((item) => `<button type="button" data-action="select-emoji" data-emoji="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
                  .join("")}
              </div>
            `
            : ""
        }
        ${
          state.pendingAttachment
            ? `
              <div class="pending-attachment">
                ${renderAttachment(state.pendingAttachment)}
                <button class="icon-btn" type="button" data-action="clear-attachment" title="${t("remove")}">${icon("close", 20)}</button>
              </div>
            `
            : ""
        }
        ${state.recording.active ? `<div class="recording-strip"><span></span> ${t("recording")}</div>` : ""}
        <div class="composer-field">
          <button class="icon-btn" type="button" data-action="toggle-emoji" title="${t("emoji")}">${icon("emoji", 25)}</button>
          <input id="messageInput" maxlength="${state.maxMessageLength}" value="${escapeHtml(state.draft)}" placeholder="${t("message")}" ${state.joined ? "" : "disabled"} />
          <button class="icon-btn" type="button" data-action="pick-file" title="${t("file")}">${icon("paperclip", 24)}</button>
          <button class="icon-btn" type="button" data-action="pick-camera" title="${t("camera")}">${icon("camera", 24)}</button>
        </div>
        <button class="send-btn" id="sendBtn" type="submit" title="${t("send")}" ${state.joined ? "" : "disabled"}>${icon(state.recording.active ? "stop" : state.draft.trim() || state.pendingAttachment ? "send" : "mic", 24)}</button>
        <input id="fileInput" class="hidden" type="file" />
        <input id="cameraInput" class="hidden" type="file" accept="image/*" capture="environment" />
      </form>
      ${state.setupOpen ? renderSetupSheet() : ""}
      ${state.infoOpen ? renderInfoModal() : ""}
    </section>
  `;
}

function render() {
  if (authState.screen !== "chat") {
    renderAuth();
    return;
  }
  if (state.view === "thread") {
    app.innerHTML = renderThread();
  } else if (state.view === "contacts") {
    app.innerHTML = renderContactScreen();
  } else {
    app.innerHTML = renderHome();
  }
  bindUI();
  attachVideoElements();
  setupLocalVideoDrag();
  if (state.view === "thread") {
    scrollMessagesBottom();
  }
}

function bindUI() {
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      state.view = "home";
      render();
    });
  });

  app.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", handleAction);
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value;
    });
  }

  const setupForm = document.getElementById("setupForm");
  if (setupForm) {
    setupForm.addEventListener("submit", handleSetupSubmit);
  }

  const messageForm = document.getElementById("messageForm");
  if (messageForm) {
    messageForm.addEventListener("submit", handleMessageSubmit);
  }

  const messageInput = document.getElementById("messageInput");
  if (messageInput) {
    messageInput.addEventListener("input", handleMessageInput);
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        messageForm?.requestSubmit();
      }
    });
  }

  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", () => handlePickedFile(fileInput.files?.[0], "file"));
  }

  const cameraInput = document.getElementById("cameraInput");
  if (cameraInput) {
    cameraInput.addEventListener("change", () => handlePickedFile(cameraInput.files?.[0], "image"));
  }

  const profileInput = document.getElementById("profileFileInput");
  if (profileInput) {
    profileInput.addEventListener("change", () => handleProfilePhoto(profileInput.files?.[0]));
  }
}

function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "open-setup") {
    state.setupOpen = true;
    state.joinError = "";
    render();
    return;
  }
  if (action === "close-setup") {
    state.setupOpen = false;
    state.joinError = "";
    render();
    return;
  }
  if (action === "open-info") {
    state.infoOpen = true;
    render();
    return;
  }
  if (action === "close-info") {
    state.infoOpen = false;
    render();
    return;
  }
  if (action === "pick-profile-photo") {
    document.getElementById("profileFileInput")?.click();
    return;
  }
  if (action === "set-lang") {
    setLanguage(event.currentTarget.dataset.lang);
    render();
    return;
  }
  if (action === "pick-file") {
    document.getElementById("fileInput")?.click();
    return;
  }
  if (action === "pick-camera") {
    document.getElementById("cameraInput")?.click();
    return;
  }
  if (action === "clear-attachment") {
    state.pendingAttachment = null;
    render();
    return;
  }
  if (action === "open-contacts") {
    state.view = "contacts";
    render();
    return;
  }
  if (action === "home") {
    state.view = "home";
    render();
    return;
  }
  if (action === "open-thread") {
    if (!state.joined) {
      state.setupOpen = true;
      render();
      return;
    }
    state.view = "thread";
    render();
    return;
  }
  if (action === "focus-search") {
    document.getElementById("searchInput")?.focus();
    return;
  }
  if (action === "voice-call") {
    startOutgoingCall("voice");
    return;
  }
  if (action === "video-call") {
    startOutgoingCall("video");
    return;
  }
  if (action === "accept-call") {
    acceptIncomingCall();
    return;
  }
  if (action === "reject-call") {
    rejectIncomingCall();
    return;
  }
  if (action === "toggle-mute") {
    toggleMute();
    return;
  }
  if (action === "toggle-camera") {
    toggleCamera();
    return;
  }
  if (action === "toggle-share") {
    toggleScreenShare();
    return;
  }
  if (action === "toggle-call-size") {
    state.call.minimized = !state.call.minimized;
    render();
    return;
  }
  if (action === "toggle-emoji") {
    state.emojiOpen = !state.emojiOpen;
    render();
    document.getElementById("messageInput")?.focus();
    return;
  }
  if (action === "select-emoji") {
    const emoji = event.currentTarget.dataset.emoji || "";
    state.draft += emoji;
    state.emojiOpen = false;
    render();
    const input = document.getElementById("messageInput");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    return;
  }
  if (action === "end-call") {
    endActiveCall();
    return;
  }
  if (action === "new-filter") {
    showToast(t("filtersReady"));
    return;
  }
  showToast(t("visualReady"));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(t("fileReadError")));
    reader.readAsDataURL(file);
  });
}

function dataUrlByteSize(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.max(0, Math.floor((base64.length * 3) / 4));
}

async function imageFileToCompressedDataUrl(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { dataUrl: await fileToDataUrl(file), size: file.size, mimeType: file.type || "application/octet-stream" };
  }
  if (typeof createImageBitmap !== "function") {
    return { dataUrl: await fileToDataUrl(file), size: file.size, mimeType: file.type || "application/octet-stream" };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
  if (!blob) {
    return { dataUrl: await fileToDataUrl(file), size: file.size, mimeType: file.type || "application/octet-stream" };
  }

  const dataUrl = await fileToDataUrl(new File([blob], "image.jpg", { type: "image/jpeg" }));
  return {
    dataUrl,
    size: dataUrlByteSize(dataUrl),
    mimeType: "image/jpeg",
  };
}

function inferAttachmentKind(file, requestedKind) {
  if (requestedKind === "image" || file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  return "file";
}

async function handlePickedFile(file, requestedKind) {
  if (!file) {
    return;
  }
  if (file.size > MAX_ATTACHMENT_BYTES * 4) {
    showToast(t("fileTooLarge"));
    return;
  }
  try {
    const kind = inferAttachmentKind(file, requestedKind);
    const prepared =
      kind === "image" ? await imageFileToCompressedDataUrl(file) : { dataUrl: await fileToDataUrl(file), size: file.size, mimeType: file.type || "application/octet-stream" };
    if (prepared.size > MAX_ATTACHMENT_BYTES) {
      showToast(t("fileTooLarge"));
      return;
    }
    state.pendingAttachment = {
      name: file.name || (requestedKind === "image" ? "kamera.jpg" : "dosya"),
      mimeType: prepared.mimeType,
      dataUrl: prepared.dataUrl,
      size: prepared.size,
      kind,
    };
    state.emojiOpen = false;
    render();
  } catch (error) {
    showToast(error.message || t("fileSelectError"));
  }
}

async function handleProfilePhoto(file) {
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    showToast(t("profileImageOnly"));
    return;
  }
  if (file.size > MAX_ATTACHMENT_BYTES * 4) {
    showToast(t("profileTooLarge"));
    return;
  }
  try {
    const prepared = await imageFileToCompressedDataUrl(file);
    if (prepared.size > MAX_ATTACHMENT_BYTES) {
      showToast(t("profileTooLarge"));
      return;
    }
    state.me.avatarUrl = prepared.dataUrl;
    const avatarInput = document.getElementById("avatarInput");
    if (avatarInput) {
      avatarInput.value = state.me.avatarUrl;
    }
    render();
  } catch (error) {
    showToast(error.message || t("profileSelectError"));
  }
}

function handleSetupSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  requestNotificationPermission();
  const payload = {
    name: form.name.value.trim(),
    avatarUrl: form.avatar.value.trim(),
    roomCode: form.roomCode?.value.trim() || "",
    roomPin: form.roomPin?.value.trim() || "",
  };

  if (!payload.name) {
    state.joinError = t("nameRequired");
    render();
    return;
  }

  state.me = { name: payload.name, avatarUrl: payload.avatarUrl };
  state.roomCode = payload.roomCode;
  state.roomPin = payload.roomPin;
  if (state.persistProfile) {
    localStorage.setItem("pingle.name", payload.name);
    localStorage.setItem("pingle.avatar", payload.avatarUrl);
    if (payload.roomCode) {
      localStorage.setItem("pingle.roomCode", payload.roomCode);
    }
  }

  if (state.joined) {
    state.setupOpen = false;
    state.joinError = "";
    render();
    showToast(t("profileSaved"));
    return;
  }

  joinRoom(payload);
}

function joinRoom(payload, options = {}) {
  if (!socket.connected) {
    state.joinError = t("waitingConnection");
    state.setupOpen = true;
    render();
    return;
  }

  socket.emit("join", payload, (response) => {
    if (!response?.ok) {
      if (options.fallbackDefault && !hadStoredName && /already in use/i.test(response?.error || "")) {
        const suffix = Math.floor(10 + Math.random() * 89);
        state.me.name = `${t("guestName")} ${suffix}`;
        if (state.persistProfile) {
          localStorage.setItem("pingle.name", state.me.name);
        }
        joinRoom({ ...payload, name: state.me.name }, { ...options, fallbackDefault: false });
        return;
      }

      state.joined = false;
      state.joinError = response?.error ? readableServerError(response.error) : t("connectionError");
      state.setupOpen = !options.silent;
      render();
      return;
    }

    state.joined = true;
    state.setupOpen = false;
    state.joinError = "";
    state.me = response.me;
    state.users = response.users || [];
    state.history = response.history || [];
    state.maxUsers = response.maxUsers || state.maxUsers;
    state.maxMessageLength = response.maxMessageLength || state.maxMessageLength;
    requestNotificationPermission();
    setupPushNotifications().catch(() => {});
    if (state.persistProfile) {
      localStorage.setItem("pingle.name", state.me.name);
      localStorage.setItem("pingle.avatar", state.me.avatarUrl || "");
    }
    render();
  });
}

function maybeAutoJoin() {
  if (
    state.autoJoinAttempted ||
    state.joined ||
    state.roomCodeRequired ||
    state.roomPinRequired ||
    !socket.connected ||
    !state.me.name
  ) {
    return;
  }
  state.autoJoinAttempted = true;
  joinRoom(
    {
      name: state.me.name,
      avatarUrl: state.me.avatarUrl,
      roomCode: state.roomCode,
      roomPin: state.roomPin,
    },
    { silent: true, fallbackDefault: true },
  );
}

function handleMessageInput(event) {
  state.draft = event.currentTarget.value;
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.innerHTML = icon(state.recording.active ? "stop" : state.draft.trim() || state.pendingAttachment ? "send" : "mic", 24);
  }

  if (!state.me.name || !state.joined) {
    return;
  }

  socket.emit("typing", true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit("typing", false);
  }, 700);
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const text = state.draft.trim();
  if (!state.joined) {
    if (!state.joined) {
      state.setupOpen = true;
      render();
    }
    return;
  }

  if (!text && !state.pendingAttachment) {
    toggleVoiceRecording();
    return;
  }

  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.disabled = true;
  }

  const payload = {
    text,
    attachment: state.pendingAttachment,
  };

  socket.emit("message", payload, (response) => {
    if (sendBtn) {
      sendBtn.disabled = false;
    }
    if (!response?.ok) {
      showToast(response?.error ? readableServerError(response.error) : t("messageSendError"));
      return;
    }
    socket.emit("typing", false);
    state.draft = "";
    state.pendingAttachment = null;
    state.emojiOpen = false;
    render();
  });
}

async function toggleVoiceRecording() {
  if (state.recording.active) {
    stopVoiceRecording();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    const recorderOptions = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined;
    const recorder = new MediaRecorder(stream, recorderOptions);
    state.recording = {
      active: true,
      recorder,
      chunks: [],
      startedAt: Date.now(),
    };

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        state.recording.chunks.push(event.data);
      }
    };
    recorder.onstop = async () => {
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      const blob = new Blob(state.recording.chunks, { type: recorder.mimeType || "audio/webm" });
      state.recording = { active: false, recorder: null, chunks: [], startedAt: 0 };
      if (!blob.size) {
        render();
        return;
      }
      if (blob.size > MAX_ATTACHMENT_BYTES) {
        showToast(t("audioTooLarge"));
        render();
        return;
      }
      const file = new File([blob], `ses-kaydi-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      await handlePickedFile(file, "audio");
    };

    recorder.start(900);
    render();
  } catch (error) {
    showToast(t("audioStartError", { error: error.message }));
  }
}

function stopVoiceRecording() {
  if (state.recording.recorder && state.recording.recorder.state !== "inactive") {
    state.recording.recorder.stop();
  }
}

function pushUniqueMessage(payload) {
  if (!payload?.id || state.history.some((item) => item.id === payload.id)) {
    return;
  }
  state.history.push(payload);
  if (state.history.length > 160) {
    state.history.splice(0, state.history.length - 160);
  }
}

function upsertMessage(payload) {
  if (!payload?.id) {
    return false;
  }
  const index = state.history.findIndex((item) => item.id === payload.id);
  if (index === -1) {
    pushUniqueMessage(payload);
    return true;
  }
  state.history[index] = { ...state.history[index], ...payload };
  return true;
}

function scrollMessagesBottom() {
  requestAnimationFrame(() => {
    const pane = document.getElementById("messagesPane");
    if (pane) {
      pane.scrollTop = pane.scrollHeight;
    }
  });
}

function setCallStatus(text) {
  state.call.status = text;
  const node = app.querySelector(".call-topline span");
  if (node) {
    node.innerHTML = `${icon(state.call.mode === "voice" ? "phone" : "video", 18)} ${escapeHtml(text)}`;
  }
}

function attachVideoElements() {
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  if (localVideo) {
    localVideo.srcObject = state.call.localStream;
    localVideo.classList.toggle("is-selfie", state.call.localFacingMode === "user");
  }
  if (remoteVideo) {
    remoteVideo.srcObject = state.call.remoteStream;
  }
}

function setupLocalVideoDrag() {
  const localVideo = document.getElementById("localVideo");
  const stage = document.querySelector(".call-video-stage");
  if (!localVideo || !stage) {
    return;
  }

  const beginDrag = (event, moveName, upName, getPoint, capture) => {
    event.preventDefault();
    capture?.();
    const stageRect = stage.getBoundingClientRect();
    const videoRect = localVideo.getBoundingClientRect();
    const point = getPoint(event);
    const start = {
      x: point.x,
      y: point.y,
      right: stageRect.right - videoRect.right,
      bottom: stageRect.bottom - videoRect.bottom,
    };

    const onMove = (moveEvent) => {
      const nextPoint = getPoint(moveEvent);
      const nextRight = start.right - (nextPoint.x - start.x);
      const nextBottom = start.bottom - (nextPoint.y - start.y);
      const maxRight = Math.max(8, stageRect.width - videoRect.width - 8);
      const maxBottom = Math.max(8, stageRect.height - videoRect.height - 8);
      state.call.localVideoPos = {
        x: Math.min(Math.max(8, nextRight), maxRight),
        y: Math.min(Math.max(8, nextBottom), maxBottom),
      };
      localVideo.style.right = `${state.call.localVideoPos.x}px`;
      localVideo.style.bottom = `${state.call.localVideoPos.y}px`;
    };

    const onUp = () => {
      window.removeEventListener(moveName, onMove);
      window.removeEventListener(upName, onUp);
      window.removeEventListener("touchcancel", onUp);
    };

    window.addEventListener(moveName, onMove, { passive: false });
    window.addEventListener(upName, onUp);
    window.addEventListener("touchcancel", onUp);
  };

  localVideo.addEventListener("pointerdown", (event) => {
    beginDrag(
      event,
      "pointermove",
      "pointerup",
      (item) => ({ x: item.clientX, y: item.clientY }),
      () => localVideo.setPointerCapture(event.pointerId),
    );
  });

  localVideo.addEventListener("mousedown", (event) => {
    beginDrag(event, "mousemove", "mouseup", (item) => ({ x: item.clientX, y: item.clientY }));
  });

  localVideo.addEventListener("touchstart", (event) => {
    beginDrag(event, "touchmove", "touchend", (item) => {
      const touch = item.touches?.[0] || item.changedTouches?.[0];
      return { x: touch?.clientX || 0, y: touch?.clientY || 0 };
    });
  });
}

function cleanupMediaTracks() {
  if (state.call.screenTrack) {
    state.call.screenTrack.stop();
    state.call.screenTrack = null;
  }
  if (state.call.localStream) {
    state.call.localStream.getTracks().forEach((track) => track.stop());
  }
  if (state.call.remoteStream) {
    state.call.remoteStream.getTracks().forEach((track) => track.stop());
  }
  state.call.localStream = null;
  state.call.remoteStream = null;
  state.call.cameraTrack = null;
}

function destroyPeerConnection() {
  if (state.call.pc) {
    state.call.pc.onicecandidate = null;
    state.call.pc.ontrack = null;
    state.call.pc.onconnectionstatechange = null;
    state.call.pc.close();
  }
  state.call.pc = null;
}

function resetCallState() {
  state.call.pendingOffer = null;
  state.call.inCall = false;
  state.call.mode = null;
  state.call.isMuted = false;
  state.call.cameraEnabled = true;
  state.call.sharingScreen = false;
  state.call.minimized = false;
  state.call.localFacingMode = "user";
  cleanupMediaTracks();
  destroyPeerConnection();
}

function endCallLocal(reasonText) {
  resetCallState();
  state.call.status = reasonText || t("ready");
  render();
}

async function setupLocalMedia(mode) {
  const constraints =
    mode === "voice"
      ? {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        }
      : {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 12, max: 15 },
          },
        };

  const stream = await getMediaWithFallback(constraints, mode);
  state.call.localStream = stream;
  state.call.cameraTrack = stream.getVideoTracks()[0] || null;
  state.call.localFacingMode = state.call.cameraTrack?.getSettings?.().facingMode || "user";
  state.call.localStream.getAudioTracks().forEach((track) => {
    track.contentHint = "speech";
  });
  state.call.localStream.getVideoTracks().forEach((track) => {
    track.contentHint = mode === "voice" ? "" : "motion";
  });
  attachVideoElements();
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    }),
  ]);
}

async function getMediaWithFallback(constraints, mode) {
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      return await withTimeout(navigator.mediaDevices.getUserMedia(constraints), 5500, "media-timeout");
    } catch (error) {
      throw new Error(t("mediaPermissionError"));
    }
  }
  throw new Error(t("mediaPermissionError"));
}

async function tuneSenderBitrate(pc) {
  const senders = pc.getSenders ? pc.getSenders() : [];
  await Promise.all(
    senders.map(async (sender) => {
      if (!sender.track || typeof sender.getParameters !== "function" || typeof sender.setParameters !== "function") {
        return;
      }
      const params = sender.getParameters();
      params.encodings = params.encodings && params.encodings.length ? params.encodings : [{}];
      if (sender.track.kind === "video") {
        params.encodings[0].maxBitrate = state.call.sharingScreen ? 420_000 : 220_000;
        params.encodings[0].maxFramerate = state.call.sharingScreen ? 10 : 15;
        params.degradationPreference = "maintain-framerate";
      }
      if (sender.track.kind === "audio") {
        params.encodings[0].maxBitrate = 20_000;
      }
      try {
        await sender.setParameters(params);
      } catch {}
    }),
  );
}

function ensurePeerConnection() {
  if (state.call.pc) {
    return state.call.pc;
  }

  const pc = new RTCPeerConnection({
    iceServers:
      Array.isArray(state.rtcIceServers) && state.rtcIceServers.length > 0
        ? state.rtcIceServers
        : [{ urls: "stun:stun.l.google.com:19302" }],
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  });
  state.call.pc = pc;
  state.call.remoteStream = new MediaStream();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("call:ice-candidate", { candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      state.call.remoteStream.addTrack(track);
    });
    attachVideoElements();
  };

  pc.onconnectionstatechange = () => {
    const status = pc.connectionState;
    if (status === "connected") {
      setCallStatus(t("connected"));
    }
    if ((status === "failed" || status === "disconnected" || status === "closed") && state.call.inCall) {
      endCallLocal(t("callEndedShort"));
    }
  };

  return pc;
}

function attachLocalTracksToPc() {
  const pc = ensurePeerConnection();
  const senders = pc.getSenders();
  const tracks = state.call.localStream.getTracks();

  if (!tracks.length && state.call.mode === "voice" && typeof pc.addTransceiver === "function") {
    pc.addTransceiver("audio", { direction: "sendrecv" });
    tuneSenderBitrate(pc).catch(() => {});
    return;
  }

  tracks.forEach((track) => {
    const exists = senders.some((sender) => sender.track && sender.track.id === track.id);
    if (!exists) {
      pc.addTrack(track, state.call.localStream);
    }
  });
  tuneSenderBitrate(pc).catch(() => {});
}

async function startOutgoingCall(mode) {
  if (!state.joined) {
    state.setupOpen = true;
    render();
    return;
  }
  if (state.call.inCall) {
    return;
  }

  try {
    state.view = "thread";
    state.call.inCall = true;
    state.call.mode = mode;
    state.call.cameraEnabled = mode !== "voice";
    state.call.status = t("mediaPreparing");
    render();

    await setupLocalMedia(mode);
    const pc = ensurePeerConnection();
    attachLocalTracksToPc();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("call:offer", { sdp: offer, mode }, (response) => {
      if (!response?.ok) {
        showToast(t("callStartError", { error: readableServerError(response?.error) }));
        endCallLocal(t("ready"));
        return;
      }
      if (response.queued) {
        setCallStatus(t("callQueued"));
        addCallLog({ direction: "outgoing", mode, status: "queued", name: otherUserName() });
        render();
        return;
      }
      setCallStatus(mode === "voice" ? t("voiceWaiting") : t("videoWaiting"));
      addCallLog({ direction: "outgoing", mode, status: "ringing", name: otherUserName() });
    });

    render();
  } catch (error) {
    showToast(t("callStartError", { error: error.message }));
    endCallLocal(t("ready"));
  }
}

async function acceptIncomingCall() {
  const offerPayload = state.call.pendingOffer;
  if (!offerPayload) {
    return;
  }

  try {
    const mode = offerPayload.mode === "voice" ? "voice" : "video";
    state.call.mode = mode;
    state.call.inCall = true;
    state.call.cameraEnabled = mode !== "voice";
    state.call.status = t("incomingAccepting");
    render();

    await setupLocalMedia(mode);
    const pc = ensurePeerConnection();
    attachLocalTracksToPc();

    await pc.setRemoteDescription(new RTCSessionDescription(offerPayload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("call:answer", { sdp: answer }, (response) => {
      if (!response?.ok) {
        showToast(t("callAnswerError", { error: readableServerError(response?.error) }));
      }
    });

    addCallLog({
      direction: "incoming",
      mode,
      status: "completed",
      name: offerPayload.from?.name || t("appName"),
    });
    state.call.pendingOffer = null;
    setCallStatus(t("callConnecting"));
    render();
  } catch (error) {
    showToast(t("callAcceptError", { error: error.message }));
    endCallLocal(t("ready"));
  }
}

function rejectIncomingCall() {
  if (!state.call.pendingOffer) {
    return;
  }
  socket.emit("call:end", { reason: "rejected" });
  state.call.pendingOffer = null;
  state.call.status = t("callRejected");
  render();
}

function endActiveCall() {
  if (!state.call.inCall && !state.call.pendingOffer) {
    return;
  }
  socket.emit("call:end", { reason: "ended" });
  endCallLocal(t("callEnded"));
}

function toggleMute() {
  if (!state.call.localStream) {
    return;
  }
  state.call.isMuted = !state.call.isMuted;
  state.call.localStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.call.isMuted;
  });
  showToast(state.call.isMuted ? t("micMuted") : t("micOn"));
  render();
}

function toggleCamera() {
  if (!state.call.localStream) {
    return;
  }
  const videoTrack = state.call.localStream.getVideoTracks()[0];
  if (!videoTrack) {
    showToast(t("noCameraCall"));
    return;
  }
  state.call.cameraEnabled = !state.call.cameraEnabled;
  videoTrack.enabled = state.call.cameraEnabled;
  showToast(state.call.cameraEnabled ? t("cameraOn") : t("cameraOff"));
  render();
}

async function stopScreenShare() {
  if (!state.call.sharingScreen || !state.call.pc || !state.call.cameraTrack) {
    return;
  }
  const sender = state.call.pc.getSenders().find((item) => item.track && item.track.kind === "video");
  if (sender) {
    await sender.replaceTrack(state.call.cameraTrack);
  }
  await tuneSenderBitrate(state.call.pc);
  if (state.call.screenTrack) {
    state.call.screenTrack.stop();
    state.call.screenTrack = null;
  }
  state.call.sharingScreen = false;
  attachVideoElements();
  render();
}

async function toggleScreenShare() {
  if (!state.call.inCall || !state.call.pc) {
    return;
  }
  if (state.call.sharingScreen) {
    await stopScreenShare();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const screenTrack = stream.getVideoTracks()[0];
    const sender = state.call.pc.getSenders().find((item) => item.track && item.track.kind === "video");
    if (!sender || !screenTrack) {
      throw new Error("Ekran paylaşımı başlatılamadı.");
    }
    await sender.replaceTrack(screenTrack);
    state.call.screenTrack = screenTrack;
    state.call.sharingScreen = true;
    await tuneSenderBitrate(state.call.pc);
    screenTrack.onended = () => {
      stopScreenShare().catch(() => {});
    };
    render();
  } catch (error) {
    showToast(t("screenShareError", { error: error.message }));
  }
}

function registerSocketHandlers(activeSocket) {
  if (!activeSocket) {
    return;
  }
  activeSocket.on("server:hello", (payload) => {
  state.maxUsers = payload.maxUsers || 2;
  state.maxMessageLength = payload.maxMessageLength || 500;
  state.roomCodeRequired = Boolean(payload.roomCodeRequired);
  state.roomPinRequired = Boolean(payload.roomPinRequired);
  if (Array.isArray(payload.iceServers) && payload.iceServers.length > 0) {
    state.rtcIceServers = payload.iceServers;
  }
  maybeAutoJoin();
  render();
});

activeSocket.on("connect", () => {
  state.connection = "online";
  if (state.joined && state.me.name) {
    state.joined = false;
    joinRoom({
      name: state.me.name,
      avatarUrl: state.me.avatarUrl,
      roomCode: state.roomCode,
      roomPin: state.roomPin,
    });
    return;
  }
  maybeAutoJoin();
  render();
});

activeSocket.on("disconnect", () => {
  state.connection = "offline";
  if (state.call.inCall) {
    endCallLocal(t("connectionLost"));
    return;
  }
  render();
});

activeSocket.on("connect_error", () => {
  state.connection = "offline";
  render();
});

activeSocket.on("message", (payload) => {
  upsertMessage(payload);
  if (!payload || payload.from === state.me.name) {
    render();
    return;
  }
  const text = normalizeMessageText(payload).primaryText || t("newMessage");
  notifyUser(payload.from, text, `message-${payload.id || payload.timestamp || Date.now()}`);
  render();
});

activeSocket.on("message:update", (payload) => {
  upsertMessage(payload);
  render();
});

activeSocket.on("offline:events", (payload) => {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  events.forEach((event) => {
    if (event.type === "message") {
      notifyUser(event.from?.name || t("appName"), event.body || t("newMessage"), `offline-message-${event.messageId || event.id}`);
    }
    if (event.type === "call") {
      const mode = event.mode === "voice" ? "voice" : "video";
      addCallLog({
        direction: "incoming",
        mode,
        status: "missed",
        name: event.from?.name || t("appName"),
      });
      notifyUser(
        event.from?.name || t("appName"),
        mode === "voice" ? t("incomingVoiceNotification") : t("incomingVideoNotification"),
        `offline-call-${event.id}`,
      );
    }
  });
  if (events.length) {
    showToast(t("offlineMessagesArrived"));
    render();
  }
});

activeSocket.on("system", (payload) => {
  // System join/leave banners are hidden to keep the chat focused on messages.
});

activeSocket.on("users", (payload) => {
  state.users = payload.users || [];
  state.maxUsers = payload.maxUsers || state.maxUsers;
  render();
});

activeSocket.on("typing", ({ name, isTyping }) => {
  if (!name || name === state.me.name) {
    return;
  }
  state.typingName = isTyping ? name : "";
  render();
});

activeSocket.on("call:offer", (payload) => {
  if (!state.joined) {
    return;
  }
  if (state.call.inCall || state.call.pendingOffer) {
    socket.emit("call:end", { reason: "busy" });
    return;
  }
  state.view = "thread";
  state.call.pendingOffer = payload;
  state.call.status = t("incomingCallStatus");
  addCallLog({
    direction: "incoming",
    mode: payload.mode,
    status: "ringing",
    name: payload.from?.name || t("appName"),
  });
  notifyUser(
    payload.from?.name || t("appName"),
    payload.mode === "voice" ? t("incomingVoiceNotification") : t("incomingVideoNotification"),
    "incoming-call",
  );
  render();
});

activeSocket.on("call:ringing", () => {
  setCallStatus(t("callRinging"));
});

activeSocket.on("call:answer", async (payload) => {
  if (!state.call.pc || !payload?.sdp) {
    return;
  }
  try {
    await state.call.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    setCallStatus(t("connected"));
  } catch (error) {
    showToast(t("answerProcessError", { error: error.message }));
  }
});

activeSocket.on("call:ice-candidate", async (payload) => {
  if (!state.call.pc || !payload?.candidate) {
    return;
  }
  try {
    await state.call.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
  } catch {}
});

activeSocket.on("call:end", (payload) => {
  const reason = payload?.reason || "ended";
  if (state.call.pendingOffer && reason !== "busy") {
    addCallLog({
      direction: "incoming",
      mode: state.call.pendingOffer.mode,
      status: reason === "rejected" ? "completed" : "missed",
      name: state.call.pendingOffer.from?.name || t("appName"),
    });
  }
  let text = t("callEndedShort");
  if (reason === "rejected") {
    text = t("callRejected");
  } else if (reason === "busy") {
    text = t("otherBusy");
  } else if (reason === "disconnect") {
    text = t("otherDisconnected");
  }
  notifyUser(t("appName"), text, "call-ended");
  endCallLocal(text);
});
}

async function preloadRtcConfig() {
  try {
    const response = await fetch("/api/rtc-config", { method: "GET" });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (payload?.ok && Array.isArray(payload.iceServers) && payload.iceServers.length > 0) {
      state.rtcIceServers = payload.iceServers;
    }
  } catch {}
}

window.addEventListener("focus", () => {
  state.windowFocused = true;
});

window.addEventListener("blur", () => {
  state.windowFocused = false;
});

preloadRtcConfig();
render();
initSocket();
