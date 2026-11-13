
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
   6. LEVENSHTEIN DISTANCE
===================================== */

// Tính số thao tác tối thiểu
// để biến chuỗi A thành chuỗi B.

function levenshteinDistance(a, b, maxDistance = Infinity) {

    const strA = Array.from(a);
    const strB = Array.from(b);

    const lenA = strA.length;
    const lenB = strB.length;

    // Nếu độ dài chênh lệch quá lớn
    // thì không cần tính tiếp.

    if (Math.abs(lenA - lenB) > maxDistance) {
        return maxDistance + 1;
    }

    // Tối ưu bộ nhớ: chỉ giữ hai hàng.
    let previous = Array.from(
        { length: lenB + 1 },
        (_, index) => index
    );

    let current = new Array(lenB + 1);

    for (let i = 1; i <= lenA; i++) {

        current[0] = i;

        let minInRow = current[0];

        for (let j = 1; j <= lenB; j++) {

            const cost =
                strA[i - 1] === strB[j - 1] ? 0 : 1;

            const insertion = current[j - 1] + 1;

            const deletion = previous[j] + 1;

            const substitution = previous[j - 1] + cost;

            current[j] = Math.min(
                insertion,
                deletion,
                substitution
            );

            minInRow = Math.min(
                minInRow,
                current[j]
            );

        }

        // Nếu mọi phương án đều vượt ngưỡng
        // thì dừng tính toán.

        if (minInRow > maxDistance) {
            return maxDistance + 1;
        }

        [previous, current] = [current, previous];

    }

    return previous[lenB];

}


/* =====================================
   7. GET MAX DISTANCE
===================================== */

// Xác định số lỗi tối đa được chấp nhận.

function getMaxDistance(length) {

    if (length <= 4) {
        return 1;
    }

    if (length <= 8) {
        return 2;
    }

    return 3;

}


/* =====================================
   8. FUZZY SEARCH
===================================== */

function searchWord(input) {

    const keyword = normalizeInput(input);

    // Kiểm tra dữ liệu
    const validation = validateInput(keyword);

    if (!validation.valid) {

        return {
            success: false,
            message: validation.message,
            results: []
        };

    }

    const removeAccent = ignoreAccent.checked;

    // Chuẩn hóa từ khóa để so sánh
    const searchKey = normalizeForCompare(
        keyword,
        removeAccent
    );

    const maxDistance = getMaxDistance(
        Array.from(searchKey).length
    );

    const results = [];

    // Duyệt qua toàn bộ từ điển
    for (const item of wordList) {

        const wordKey = normalizeForCompare(
            item.original,
            removeAccent
        );

        // Tính khoảng cách
        const distance = levenshteinDistance(
            searchKey,
            wordKey,
            maxDistance
        );

        // Chỉ lấy những từ nằm trong ngưỡng
        if (distance <= maxDistance) {

            const maxLength = Math.max(
                Array.from(searchKey).length,
                Array.from(wordKey).length
            );

            // Độ tương đồng tham khảo
            const similarity = maxLength === 0
                ? 100
                : Math.round(
                    (1 - distance / maxLength) * 100
                );

            results.push({

                word: item.original,

                distance: distance,

                similarity: similarity

            });

        }

    }

    // Sắp xếp:
    // 1. Khoảng cách nhỏ nhất.
    // 2. Độ tương đồng cao nhất.
    // 3. Thứ tự chữ cái tiếng Việt.

    results.sort((a, b) => {

        if (a.distance !== b.distance) {
            return a.distance - b.distance;
        }

        if (a.similarity !== b.similarity) {
            return b.similarity - a.similarity;
        }

        return a.word.localeCompare(
            b.word,
            "vi"
        );

    });

    return {

        success: true,

        message: results.length > 0
            ? "Tìm thấy " + results.length + " kết quả."
            : "Không tìm thấy từ phù hợp.",

        results: results.slice(0, CONFIG.maxResults)

    };

}


/* =====================================
   9. DISPLAY RESULTS
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

    for (const item of data.results) {

        const li = document.createElement("li");

        li.className = "result-item";

        const word = document.createElement("span");

        word.className = "result-word";

        word.textContent = item.word;

        const info = document.createElement("span");

        info.className = "result-info";

        info.textContent =
            "Khoảng cách: " + item.distance +
            " | Tương đồng: " + item.similarity + "%";

        li.appendChild(word);

        li.appendChild(info);

        resultList.appendChild(li);

    }

}


/* =====================================
   10. HANDLE SEARCH
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
   11. EVENT LISTENERS
===================================== */

// Nhấn nút tìm kiếm
searchButton.addEventListener(
    "click",
    handleSearch
);


// Nhấn Enter để tìm kiếm
searchInput.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {
            handleSearch();
        }

    }
);


// Tự động chuẩn hóa khi rời khỏi ô nhập
searchInput.addEventListener(
    "blur",
    function() {

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
