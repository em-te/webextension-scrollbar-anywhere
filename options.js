chrome.storage.local.get(
  {likeTouch: false},
  ({likeTouch}) => document.f.behave[likeTouch ? 1 : 0].checked = true
);
document.f.behave[0].onchange = document.f.behave[1].onchange = () => {
  chrome.storage.local.set({likeTouch: document.f.behave[1].checked});
}
document.querySelectorAll("[i18n]").forEach(n => n.textContent = chrome.i18n.getMessage(n.getAttribute("i18n")));