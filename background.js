// 메시지 리스너 개선
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // 로깅 개선
  console.log("Message received:", {
    from: sender.tab ? `Tab ${sender.tab.url}` : "Extension",
    action: request.action,
    data: request,
  });

  // 메시지 처리 로직
  if (request.action === "FINISH") {
    // 비동기 응답 처리
    sendResponse({ status: "success", message: "Operation completed" });
  }

  // 비동기 응답을 위해 true 반환
  return true;
});

// API 요청 함수 개선
function fetchData() {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error("Failed to parse response: " + error.message));
        }
      } else {
        reject(new Error("Request failed: " + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error("Network error occurred"));

    // 타임아웃 설정
    xhr.timeout = 5000;
    xhr.ontimeout = () => reject(new Error("Request timed out"));

    try {
      xhr.open("GET", "https://api.example.com/data.json", true);
      xhr.send();
    } catch (error) {
      reject(new Error("Failed to send request: " + error.message));
    }
  });
}

// 에러 처리와 함께 API 호출 사용
fetchData()
  .then((response) => {
    console.log("Data received:", response);
  })
  .catch((error) => {
    console.error("Error fetching data:", error);
  });
