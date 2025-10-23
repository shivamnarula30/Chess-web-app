// ======= Chess piece Unicode and initial setup =======
const pieces = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

let board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let currentTurn = 'white';
let selectedSquare = null;
let moveHistory = [];
let isFlipped = false;
let whiteTime = 600;
let blackTime = 600;
let clockInterval = null;

// Multiplayer
let currentRoom = null;
let playerColor = null;
let isOnlineGame = false;
let gameListener = null;

// Sound effects
const moveSound = new Audio('standard_move.wav');
const captureSound = new Audio('standard_capture.wav');

// Firebase v10 modular: triggers game init
document.addEventListener('firebaseReady', () => {
    setupGame();
});

function setupGame() {
    createBoard();
    setupEventListeners();
    updateTimers();
    addBoardNotation();
}

// ======= Board & UI Functions =======
function addBoardNotation() {
    const wrapper = document.querySelector('.board-wrapper');
    const oldNotation = wrapper.querySelectorAll('.notation');
    oldNotation.forEach(n => n.remove());
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    files.forEach((file, index) => {
        const fileLabel = document.createElement('div');
        fileLabel.className = 'notation file-notation';
        fileLabel.textContent = isFlipped ? files[7 - index] : file;
        fileLabel.style.position = 'absolute';
        fileLabel.style.bottom = '0px';
        fileLabel.style.left = `${index * 60 + 25}px`;
        fileLabel.style.fontSize = '12px';
        fileLabel.style.fontWeight = 'bold';
        wrapper.appendChild(fileLabel);
    });
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    ranks.forEach((rank, index) => {
        const rankLabel = document.createElement('div');
        rankLabel.className = 'notation rank-notation';
        rankLabel.textContent = isFlipped ? ranks[7 - index] : rank;
        rankLabel.style.position = 'absolute';
        rankLabel.style.left = '0px';
        rankLabel.style.top = `${index * 60 + 25}px`;
        rankLabel.style.fontSize = '12px';
        rankLabel.style.fontWeight = 'bold';
        wrapper.appendChild(rankLabel);
    });
}

function createBoard() {
    const chessboard = document.getElementById('chessboard');
    chessboard.innerHTML = '';
    const currentTheme = document.getElementById('boardTheme')?.value || 'classic';
    chessboard.className = 'chessboard';
    chessboard.classList.add(`theme-${currentTheme}`);
    const displayBoard = isFlipped ? [...board].reverse() : board;
    displayBoard.forEach((row, rowIndex) => {
        const actualRow = isFlipped ? 7 - rowIndex : rowIndex;
        const displayRow = isFlipped ? [...row].reverse() : row;
        displayRow.forEach((piece, colIndex) => {
            const actualCol = isFlipped ? 7 - colIndex : colIndex;
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.row = actualRow;
            square.dataset.col = actualCol;
            if ((actualRow + actualCol) % 2 === 0) {
                square.classList.add('light');
            } else {
                square.classList.add('dark');
            }
            if (piece) {
                const pieceElement = document.createElement('div');
                pieceElement.className = 'piece';
                pieceElement.textContent = pieces[piece];
                pieceElement.draggable = true;
                square.appendChild(pieceElement);
                square.classList.add('has-piece');
            }
            square.addEventListener('click', handleSquareClick);
            square.addEventListener('dragstart', handleDragStart);
            square.addEventListener('dragover', handleDragOver);
            square.addEventListener('drop', handleDrop);
            chessboard.appendChild(square);
        });
    });
}

function setupEventListeners() {
    document.getElementById('flipBoard').addEventListener('click', () => {
        flipBoard();
        addBoardNotation();
    });
    document.getElementById('resetGame').addEventListener('click', resetGame);
    document.getElementById('createRoom').addEventListener('click', createRoom);
    document.getElementById('joinRoom').addEventListener('click', joinRoom);
    document.getElementById('boardTheme').addEventListener('change', (e) => {
        changeBoardTheme(e.target.value);
    });
}

function changeBoardTheme(theme) {
    const chessboard = document.getElementById('chessboard');
    chessboard.className = 'chessboard';
    chessboard.classList.add(`theme-${theme}`);
}

function handleSquareClick(e) {
    const square = e.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    if (isOnlineGame && playerColor !== currentTurn) return;
    if (selectedSquare) {
        movePiece(selectedSquare.row, selectedSquare.col, row, col);
        clearHighlights();
        selectedSquare = null;
    } else {
        const piece = board[row][col];
        if (piece && isCorrectTurn(piece)) {
            selectedSquare = { row, col };
            highlightSquare(square);
            highlightLegalMoves(row, col);
        }
    }
}

function handleDragStart(e) {
    const square = e.target.parentElement;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const piece = board[row][col];
    if (!piece || !isCorrectTurn(piece)) {
        e.preventDefault();
        return;
    }
    if (isOnlineGame && playerColor !== currentTurn) {
        e.preventDefault();
        return;
    }
    selectedSquare = { row, col };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${row},${col}`);
    highlightLegalMoves(row, col);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const square = e.currentTarget;
    const targetRow = parseInt(square.dataset.row);
    const targetCol = parseInt(square.dataset.col);
    if (selectedSquare) {
        movePiece(selectedSquare.row, selectedSquare.col, targetRow, targetCol);
        selectedSquare = null;
    }
    clearHighlights();
}

function movePiece(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    if (!piece || !isCorrectTurn(piece)) return false;
    if (!isLegalMove(fromRow, fromCol, toRow, toCol)) return false;
    const capturedPiece = board[toRow][toCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';
    if (capturedPiece) {
        captureSound.play().catch(() => {});
    } else {
        moveSound.play().catch(() => {});
    }
    const move = {
        from: columnToLetter(fromCol) + (8 - fromRow),
        to: columnToLetter(toCol) + (8 - toRow),
        piece: piece,
        captured: capturedPiece,
        turn: currentTurn,
        fromRow, fromCol, toRow, toCol // needed for multiplayer sync
    };
    moveHistory.push(move);
    updateMoveHistory();
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    if (!clockInterval) startClock();
    createBoard();

    // Multiplayer sync
    if (isOnlineGame && currentRoom) {
        sendMoveToFirebase(move);
    }
    return true;
}

function isCorrectTurn(piece) {
    if (currentTurn === 'white') {
        return piece === piece.toUpperCase();
    } else {
        return piece === piece.toLowerCase();
    }
}

function isLegalMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol].toLowerCase();
    const targetPiece = board[toRow][toCol];
    if (targetPiece && isCorrectTurn(targetPiece)) return false;
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    switch(piece) {
        case 'p':
            return isLegalPawnMove(fromRow, fromCol, toRow, toCol);
        case 'r':
            return isLegalRookMove(fromRow, fromCol, toRow, toCol);
        case 'n':
            return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
        case 'b':
            return isLegalBishopMove(fromRow, fromCol, toRow, toCol);
        case 'q':
            return isLegalRookMove(fromRow, fromCol, toRow, toCol) || isLegalBishopMove(fromRow, fromCol, toRow, toCol);
        case 'k':
            return rowDiff <= 1 && colDiff <= 1;
        default:
            return false;
    }
}

function isLegalPawnMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const isWhite = piece === piece.toUpperCase();
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;
    if (fromCol === toCol && !board[toRow][toCol]) {
        if (toRow === fromRow + direction) return true;
        if (fromRow === startRow && toRow === fromRow + 2 * direction && !board[fromRow + direction][fromCol]) return true;
    }
    if (Math.abs(toCol - fromCol) === 1 && toRow === fromRow + direction && board[toRow][toCol]) return true;
    return false;
}

function isLegalRookMove(fromRow, fromCol, toRow, toCol) {
    if (fromRow !== toRow && fromCol !== toCol) return false;
    return !isPathBlocked(fromRow, fromCol, toRow, toCol);
}
function isLegalBishopMove(fromRow, fromCol, toRow, toCol) {
    if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;
    return !isPathBlocked(fromRow, fromCol, toRow, toCol);
}
function isPathBlocked(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    while (currentRow !== toRow || currentCol !== toCol) {
        if (board[currentRow][currentCol]) return true;
        currentRow += rowStep;
        currentCol += colStep;
    }
    return false;
}

// ======= Visual Functions =======
function highlightSquare(square) {
    square.classList.add('selected');
}
function highlightLegalMoves(row, col) {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const targetRow = parseInt(square.dataset.row);
        const targetCol = parseInt(square.dataset.col);
        if (isLegalMove(row, col, targetRow, targetCol)) {
            square.classList.add('legal-move');
        }
    });
}
function clearHighlights() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('selected', 'legal-move');
    });
}
function flipBoard() {
    isFlipped = !isFlipped;
    createBoard();
}
function resetGame() {
    if (isOnlineGame && currentRoom) {
        if (!confirm('Leave current game and start new local game?')) return;
        leaveRoom();
    }
    board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    currentTurn = 'white';
    moveHistory = [];
    whiteTime = 600;
    blackTime = 600;
    selectedSquare = null;
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
    createBoard();
    updateMoveHistory();
    updateTimers();
}
function updateMoveHistory() {
    const moveList = document.getElementById('moveList');
    moveList.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = moveHistory[i];
        const blackMove = moveHistory[i + 1];
        const moveEntry = document.createElement('div');
        moveEntry.className = 'move-entry';
        moveEntry.innerHTML = `
            <span class="move-number">${moveNumber}.</span>
            <span class="move">${whiteMove.from}${whiteMove.captured ? 'x' : '-'}${whiteMove.to}</span>
            ${blackMove ? `<span class="move">${blackMove.from}${blackMove.captured ? 'x' : '-'}${blackMove.to}</span>` : ''}
        `;
        moveList.appendChild(moveEntry);
    }
    moveList.scrollTop = moveList.scrollHeight;
}
function startClock() {
    clockInterval = setInterval(() => {
        if (currentTurn === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                clearInterval(clockInterval);
                alert('Black wins on time!');
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                clearInterval(clockInterval);
                alert('White wins on time!');
            }
        }
        updateTimers();
    }, 1000);
}
function updateTimers() {
    document.getElementById('whiteTime').textContent = formatTime(whiteTime);
    document.getElementById('blackTime').textContent = formatTime(blackTime);
    if (currentTurn === 'white') {
        document.getElementById('whitePlayer').classList.add('active');
        document.getElementById('blackPlayer').classList.remove('active');
    } else {
        document.getElementById('blackPlayer').classList.add('active');
        document.getElementById('whitePlayer').classList.remove('active');
    }
}
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function columnToLetter(col) {
    return String.fromCharCode(97 + col);
}

// ===== MULTIPLAYER ====
// -- Room Management --
function createRoom() {
    if (!window.firebaseReady) {
        alert('Firebase is not ready yet. Please wait...');
        return;
    }
    const roomCode = generateRoomCode();
    currentRoom = roomCode;
    playerColor = 'white';
    isOnlineGame = true;
    resetGameState();
    const roomRef = window.firebaseRef(window.firebaseDB, `rooms/${roomCode}`);
    window.firebaseSet(roomRef, {
        board: board,
        currentTurn: currentTurn,
        moveHistory: moveHistory,
        whiteTime: whiteTime,
        blackTime: blackTime,
        players: { white: true, black: false },
        createdAt: Date.now()
    });
    const playerRef = window.firebaseRef(window.firebaseDB, `rooms/${roomCode}/players/white`);
    window.firebaseOnDisconnect(playerRef).set(false);
    listenToGameUpdates(roomCode);
    listenToMoves(roomCode); // ADDED - start move listener!
    document.getElementById('roomInfo').style.display = 'block';
    document.getElementById('roomCode').textContent = roomCode;
    document.getElementById('playerColor').textContent = 'White';
    document.getElementById('gameStatus').textContent = 'Waiting for opponent...';
}
function joinRoom() {
    if (!window.firebaseReady) {
        alert('Firebase is not ready yet. Please wait...');
        return;
    }
    const roomCode = prompt('Enter room code:');
    if (!roomCode) return;
    const upperRoomCode = roomCode.toUpperCase();
    const roomRef = window.firebaseRef(window.firebaseDB, `rooms/${upperRoomCode}`);
    window.firebaseOnValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert('Room not found!');
            return;
        }
        if (data.players && data.players.black) {
            alert('Room is full!');
            return;
        }
        currentRoom = upperRoomCode;
        playerColor = 'black';
        isOnlineGame = true;
        const playersRef = window.firebaseRef(window.firebaseDB, `rooms/${currentRoom}/players`);
        window.firebaseUpdate(playersRef, { black: true });
        const playerRef = window.firebaseRef(window.firebaseDB, `rooms/${currentRoom}/players/black`);
        window.firebaseOnDisconnect(playerRef).set(false);
        loadGameFromFirebase(data);
        listenToGameUpdates(currentRoom);
        listenToMoves(currentRoom); // ADDED - start move listener!
        document.getElementById('roomInfo').style.display = 'block';
        document.getElementById('roomCode').textContent = currentRoom;
        document.getElementById('playerColor').textContent = 'Black';
        document.getElementById('gameStatus').textContent = 'Game started!';
        if (!isFlipped) {
            flipBoard();
            addBoardNotation();
        }
    }, { onlyOnce: true });
}

function listenToGameUpdates(roomCode) {
    const roomRef = window.firebaseRef(window.firebaseDB, `rooms/${roomCode}`);
    gameListener = window.firebaseOnValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        if (data.players && data.players.white && data.players.black) {
            document.getElementById('gameStatus').textContent = 'Game in progress';
        } else {
            if (playerColor === 'white') {
                document.getElementById('gameStatus').textContent = 'Waiting for opponent...';
            }
        }
        if (data.board && data.currentTurn &&
            (JSON.stringify(board) !== JSON.stringify(data.board) || currentTurn !== data.currentTurn)) {
            loadGameFromFirebase(data);
        }
    });
}

// -------- Now, LIVE MOVE SYNC LISTENER! ---------
function listenToMoves(roomCode) {
    const movesRef = window.firebaseRef(window.firebaseDB, `rooms/${roomCode}/moves`);
    window.firebaseOnValue(movesRef, (snapshot) => {
        const firebaseMoves = snapshot.val();
        if (!firebaseMoves) return;
        Object.keys(firebaseMoves).forEach((i) => {
            // If move not in history, apply it
            if (!moveHistory[i]) {
                const move = firebaseMoves[i];
                applyFirebaseMove(move);
            }
        });
    });
}

// -- Send move to DB --
function sendMoveToFirebase(move) {
    const newMoveRef = window.firebaseRef(window.firebaseDB, `rooms/${currentRoom}/moves/${moveHistory.length - 1}`);
    window.firebaseSet(newMoveRef, move);
}

// -- Apply opponent’s move received from Firebase --
function applyFirebaseMove(move) {
    const { fromRow, fromCol, toRow, toCol, piece, captured, turn } = move;
    board[toRow][toCol] = board[fromRow][fromCol];
    board[fromRow][fromCol] = '';
    currentTurn = turn === 'white' ? 'black' : 'white';
    moveHistory.push(move);
    createBoard();
    updateMoveHistory();
    updateTimers();
}

// Room/online actions
function syncGameState() {
    if (!currentRoom || !window.firebaseReady) return;
    const roomRef = window.firebaseRef(window.firebaseDB, `rooms/${currentRoom}`);
    window.firebaseUpdate(roomRef, {
        board: board,
        currentTurn: currentTurn,
        moveHistory: moveHistory,
        whiteTime: whiteTime,
        blackTime: blackTime,
        lastUpdate: Date.now()
    });
}
function loadGameFromFirebase(data) {
    board = data.board;
    currentTurn = data.currentTurn;
    moveHistory = data.moveHistory || [];
    whiteTime = data.whiteTime || 600;
    blackTime = data.blackTime || 600;
    createBoard();
    updateMoveHistory();
    updateTimers();
}

function leaveRoom() {
    if (currentRoom && window.firebaseReady) {
        const roomRef = window.firebaseRef(window.firebaseDB, `rooms/${currentRoom}`);
        window.firebaseRemove(roomRef);
    }
    currentRoom = null;
    playerColor = null;
    isOnlineGame = false;
    document.getElementById('roomInfo').style.display = 'none';
    if (gameListener) {
        gameListener = null;
    }
}

function resetGameState() {
    board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    currentTurn = 'white';
    moveHistory = [];
    whiteTime = 600;
    blackTime = 600;
    createBoard();
    updateMoveHistory();
    updateTimers();
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initialize game when Firebase ready (redundant if using event)
if (window.firebaseReady) setupGame();
