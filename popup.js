document.addEventListener("DOMContentLoaded", () => {
  // 탭 전환 기능
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // 모든 탭 버튼과 컨텐츠의 active 클래스 제거
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // 클릭된 탭 버튼과 해당 컨텐츠에 active 클래스 추가
      button.classList.add("active");
      const tabId = button.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });

  // 픽셀 크기 설정 기능
  const form = document.querySelector(".settings-form");
  const radioButtons = form.querySelectorAll('input[type="radio"]');

  // 저장된 값 불러오기
  chrome.storage.sync.get("pixelSize", ({ pixelSize }) => {
    const defaultSize = pixelSize || "20";
    const radio = form.querySelector(`input[value="${defaultSize}"]`);
    if (radio) radio.checked = true;
  });

  // 라디오 버튼 변경 이벤트
  radioButtons.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const pixelSize = e.target.value;
      // 스토리지에 저장
      chrome.storage.sync.set({ pixelSize });
      // content script에 메시지 전송
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "PIXEL_SIZE_CHANGED",
          pixelSize: parseInt(pixelSize),
        });
      });
    });
  });
});
