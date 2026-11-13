
"use strict";

/* =====================================
   1. GLOBAL CONFIGURATION 
===================================== */

const CONFIG = {
    maxResults: 30,
    maxInputLength: 100
};

// Dữ liệu từ điển
let wordList = [];


/* =====================================
   2. DOM ELEMENTS 
===================================== */

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

const ignoreAccent = document.getElementById("ignoreAccent");

const inputMessage = document.getElementById("inputMessage");

const totalWords = document.getElementById("totalWords");
const resultCount = document.getElementById("resultCount");

const resultList = document.getElementById("resultList");
const resultStatus = document.getElementById("resultStatus");


/* =====================================
   3. NORMALIZE INPUT
===================================== */

// Chuẩn hóa nội dung nhập
function normalizeInput(input) {

    return input
        .normalize("NFC")
        .trim()
        .toLocaleLowerCase("vi-VN")
        .replace(/\s+/g, " ");

}


// Chuẩn hóa để so sánh
function normalizeForCompare(input, removeAccent = false) {

    let result = normalizeInput(input);

    if (removeAccent) {

        result = result
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .normalize("NFC");

    }

    return result;

}
/* =====================================
   4. VALIDATE INPUT
===================================== */

function validateInput(input) {

    if (!input) {

        return {
            valid: false,
            message: "Vui lòng nhập từ cần tìm."
        };

    }

    if (input.length > CONFIG.maxInputLength) {

        return {
            valid: false,
            message: "Từ khóa vượt quá giới hạn 100 ký tự."
        };

    }

    // Cho phép chữ Unicode, khoảng trắng,
    // dấu nháy đơn và dấu gạch nối.

    const validPattern = /^[\p{L}\p{M}\s'-]+$/u;

    if (!validPattern.test(input)) {

        return {
            valid: false,
            message: "Từ khóa chứa ký tự không hợp lệ."
        };

    }

    return {
        valid: true,
        message: "Dữ liệu hợp lệ."
    };

}


/* =====================================
   5. LOAD WORDS FROM TXT
===================================== */

async function loadWords() {

    try {

        resultStatus.textContent = "Đang tải dữ liệu...";

        const response = await fetch("./data/tu.txt");

        if (!response.ok) {

            throw new Error(
                "Không thể tải tu.txt: " + response.status
            );

        }

        const text = await response.text();

        // Tách từng dòng
        const lines = text.split(/\r?\n/);

        // Loại bỏ dòng trống và từ trùng lặp
        const uniqueWords = new Set();

        wordList = lines
            .map(line => normalizeInput(line))
            .filter(word => {

                if (!word) return false;

                if (uniqueWords.has(word)) {
                    return false;
                }

                uniqueWords.add(word);

                return true;

            })
            .map(word => ({
                original: word,
                normalized: word
            }));

        totalWords.textContent = wordList.length;

        resultStatus.textContent = "Đã tải từ điển thành công.";

        searchButton.disabled = false;

    }
    catch (error) {

        console.error(error);

        resultStatus.textContent = "Lỗi tải từ điển.";

        inputMessage.textContent =
            "Không thể đọc dữ liệu. Hãy kiểm tra file tu.txt.";

        inputMessage.className = "message error";

        searchButton.disabled = true;

    }

}


/* =====================================
   6. PREFIX SEARCH
===================================== */

function searchWord(input) {

    const keyword = normalizeInput(input);
    const validation = validateInput(keyword);

    if (!validation.valid) {

        return {
            success: false,
            message: validation.message,
            results: []
        };

    }

    const searchKey = normalizeForCompare(
        keyword,
        ignoreAccent.checked
    );

    const results = wordList
        .filter(item => {

            const wordKey = normalizeForCompare(
                item.normalized,
                ignoreAccent.checked
            );

            return wordKey.startsWith(searchKey);

        })
        .sort((a, b) => a.original.localeCompare(b.original, "vi"))
        .slice(0, CONFIG.maxResults)
        .map(item => ({
            word: item.original
        }));

    return {
        success: true,
        message: results.length > 0
            ? "Tìm thấy " + results.length + " kết quả."
            : "Không tìm thấy từ bắt đầu bằng \"" + keyword + "\".",
        results: results
    };

}





/* =====================================
   7. DISPLAY RESULTS
===================================== */

function displayResults(data) {

    // Xóa kết quả cũ
    resultList.replaceChildren();

    resultCount.textContent = data.results.length;

    if (!data.success || data.results.length === 0) {

        const emptyItem = document.createElement("li");

        emptyItem.className = "empty-result";

        emptyItem.textContent = data.message;

        resultList.appendChild(emptyItem);

        return;

    }
    // Hiển thị kết quả tìm kiếm thêm nút sao chép
    for (const item of data.results) {

        const li = document.createElement("li");

        li.className = "result-item";

        const word = document.createElement("span");

        word.className = "result-word";

        word.textContent = item.word;

        li.appendChild(word);

        resultList.appendChild(li);

        const copyButton = document.createElement("button");

        copyButton.className = "copy-button";

        copyButton.textContent = "Sao chép";

        copyButton.addEventListener("click", function () {

            navigator.clipboard.writeText(item.word);

        });

        li.appendChild(copyButton);

    }

}

/* =====================================
   8. HANDLE SEARCH
===================================== */

function handleSearch() {

    const rawInput = searchInput.value;

    const keyword = normalizeInput(rawInput);

    // Kiểm tra đầu vào trước
    const validation = validateInput(keyword);

    if (!validation.valid) {

        inputMessage.textContent = validation.message;

        inputMessage.className = "message error";

        displayResults({

            success: false,

            message: validation.message,

            results: []

        });

        return;

    }

    // Cập nhật nội dung đã chuẩn hóa
    searchInput.value = keyword;

    inputMessage.textContent = "Đang tìm kiếm...";

    inputMessage.className = "message";

    // Thực hiện tìm kiếm
    const data = searchWord(keyword);

    // Hiển thị kết quả
    displayResults(data);

    inputMessage.textContent = "Dữ liệu hợp lệ.";

    inputMessage.className = "message success";

    resultStatus.textContent = data.message;

}


/* =====================================
   9. EVENT LISTENERS
===================================== */

// Nhấn nút tìm kiếm
searchButton.addEventListener(
    "click",
    handleSearch
);


// Nhấn Enter để tìm kiếm
searchInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {
            handleSearch();
        }

    }
);


// Tự động chuẩn hóa khi rời khỏi ô nhập
searchInput.addEventListener(
    "blur",
    function () {

        searchInput.value = normalizeInput(
            searchInput.value
        );

    }
);


// Khởi tạo ứng dụng
document.addEventListener(
    "DOMContentLoaded",
    loadWords
);
