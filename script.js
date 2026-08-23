var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;
var stockfish = new Worker("https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js");

function startGame(color) {
    playerColor = color;
    $('#startScreen').fadeOut(300);
    $('#gameOverModal').fadeOut(300);
    
    game.reset();
    var config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare,
        onSnapEnd: function() { board.position(game.fen()); }
    };
    
    board = Chessboard('board', config);
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') {
        window.setTimeout(computeBestMove, 500);
    }
}

// تشغيل Stockfish الحقيقي بقوة جيدة
function computeBestMove() {
    if (game.game_over()) return;
    updateStatus(true);
    stockfish.postMessage("position fen " + game.fen());
    stockfish.postMessage("go depth 12"); // مستوى ذكاء قوي ومناسب للعبة ممتعة
}

stockfish.onmessage = function(event) {
    var line = event.data;
    if (line.startsWith("bestmove")) {
        var bestMove = line.split(" ")[1];
        if (bestMove) {
            game.move({
                from: bestMove.substring(0, 2),
                to: bestMove.substring(2, 4),
                promotion: bestMove.substring(4, 5) || 'q'
            });
            board.position(game.fen());
            updateStatus();
            updateCapturedPieces();
            checkGameOver();
        }
    }
};

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (playerColor === 'white' && piece.search(/^b/) !== -1) return false;
    if (playerColor === 'black' && piece.search(/^w/) !== -1) return false;
}

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    removeGreySquares();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();

    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
    if (game.turn() === aiTurnCheck && !game.game_over()) {
        computeBestMove();
    }
}

// حساب وعرض القطع المأخوذة
function updateCapturedPieces() {
    var history = game.history({ verbose: true });
    var whiteCaptured = [];
    var blackCaptured = [];

    for (var i = 0; i < history.length; i++) {
        if (history[i].captured) {
            var piece = history[i].captured.toUpperCase();
            if (history[i].color === 'w') {
                blackCaptured.push(getPieceSymbol(piece, 'b'));
            } else {
                whiteCaptured.push(getPieceSymbol(piece, 'w'));
            }
        }
    }

    if (playerColor === 'white') {
        $('#playerCaptured').text(whiteCaptured.join(' '));
        $('#opponentCaptured').text(blackCaptured.join(' '));
    } else {
        $('#playerCaptured').text(blackCaptured.join(' '));
        $('#opponentCaptured').text(whiteCaptured.join(' '));
    }
}

function getPieceSymbol(piece, color) {
    const symbols = {
        'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚'
    };
    return symbols[piece] || '';
}

function checkGameOver() {
    if (game.game_over()) {
        var text = "";
        if (game.in_checkmate()) {
            text = game.turn() === playerColor[0] ? "لقد هزمك أيانوكوجي! الفوز هو الأهم دائماً..." : "فاجأت الجميع وهزمت أيانوكوجي! إنجاز أسطوري!";
        } else {
            text = "انتهت اللعبة تعادلاً.";
        }
        $('#winnerText').text(text);
        $('#gameOverModal').fadeIn(300);
    }
}

function closeModalAndRestart() {
    $('#gameOverModal').fadeOut(300);
    $('#startScreen').fadeIn(300);
}

// المساعدات البصرية للمبتدئين
function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    greySquare(square);
    for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to);
    }
}

function onMouseoutSquare(square, piece) {
    removeGreySquares();
}

function greySquare(square) {
    var squareEl = $('#board .square-' + square);
    var background = '#a9a9a9';
    if (squareEl.hasClass('black-3c85d')) background = '#696969';
    squareEl.css('background', background);
}

function removeGreySquares() {
    $('#board .square-55d63').css('background', '');
}

const translations = {
    ar: {
        ayanokojiName: "أيانوكوجي كيوتاكا",
        ayanokojiRole: `"في هذا العالم، الفوز هو كل شيء؛ لا تهم الطريقة، ولا يهم من يجب التضحية به، طالما أنني أفوز في النهاية، فهذا هو الأهم"`,
        playerName: "YOU (أنت)",
        restartBtn: "إعادة اللعبة",
        statusReady: "الحالة: دورك",
        statusThinking: "أيانوكوجي يحلل الحركات...",
        checkmate: "انتهت اللعبة!"
    },
    en: {
        ayanokojiName: "Ayanokoji Kiyotaka",
        ayanokojiRole: `"In this world, winning is everything..."`,
        playerName: "YOU",
        restartBtn: "Restart",
        statusReady: "Status: Your turn",
        statusThinking: "Ayanokoji is analyzing...",
        checkmate: "Game Over!"
    },
    ja: {
        ayanokojiName: "綾小路 清隆",
        ayanokojiRole: `"この世界は勝利がすべてだ..."`,
        playerName: "YOU (あなた)",
        restartBtn: "リスタート",
        statusReady: "状態: あなたの番です",
        statusThinking: "綾小路が分析中...",
        checkmate: "ゲームオーバー！"
    }
};

let currentLang = 'ar';

function updateStatus(isThinking = false) {
    var t = translations[currentLang];
    var status = isThinking ? t.statusThinking : (game.turn() === playerColor[0] ? t.statusReady : t.statusThinking);
    $('#status').text(status);
}

$('#restartBtn').on('click', function() {
    $('#startScreen').fadeIn(300);
});

$('#themeToggle').on('click', function() {
    $('body').toggleClass('dark-theme light-theme');
});

$('#fullscreenToggle').on('click', function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
});

$('#hintsToggle').on('click', function() {
    showHints = !showHints;
    $(this).css('opacity', showHints ? '1' : '0.5');
});

$('#langSelect').on('change', function() {
    currentLang = $(this).val();
    let t = translations[currentLang];
    $('#htmlRoot').attr('lang', currentLang);
    $('#htmlRoot').attr('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    $('#ayanokojiName').text(t.ayanokojiName);
    $('#ayanokojiRole').text(t.ayanokojiRole);
    $('#playerName').text(t.playerName);
    $('#restartBtn').text(t.restartBtn);
    updateStatus();
});
