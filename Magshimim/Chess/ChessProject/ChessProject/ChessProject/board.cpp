#include "board.h"
#include "bishop.h"
#include "king.h"
#include "pawn.h"
#include "queen.h"
#include "rook.h"
#include "knight.h"
#include "nothing.h"

board::board(std::string string_board)
{
	this->_board_string = string_board;

	initBoard();
}

void board::initBoard()
{
	int count = 0;
	char charOfPiece;
	for (int rows = 0; rows < BOARD_LIMIT; rows++)
	{
		for (int cols = 0; cols < BOARD_LIMIT; cols++)
		{
			charOfPiece = this->_board_string[count];
			piece* new_piece = nullptr;
			if (charOfPiece == black_rook || charOfPiece == WHITE_ROOK)
			{
				new_piece = new Rook(charOfPiece, rows, cols);
			}
			if (charOfPiece == black_queen || charOfPiece == WHITE_QUEEN)
			{
				new_piece = new Queen(charOfPiece, rows, cols);
			}
			if (charOfPiece == black_pawn || charOfPiece == WHITE_PAWN)
			{
				new_piece = new Pawn(charOfPiece, rows, cols);
			}
			if (charOfPiece == black_Knight || charOfPiece == WHITE_KNIGHT)
			{
				new_piece = new Knight(charOfPiece, rows, cols);
			}
			if (charOfPiece == black_bishop || charOfPiece == WHITE_BISHOP)
			{
				new_piece = new Bishop(charOfPiece, rows, cols);
			}
			if (charOfPiece == black_king || charOfPiece == WHITE_KING)
			{
				new_piece = new King(charOfPiece, rows, cols);
			}
			if (charOfPiece == emptySpace)
			{
				new_piece = new nothing(charOfPiece, rows, cols);
			}
			this->_board[rows][cols] = new_piece;
			count++;
		}
	}
}
void board::printBoard()
{
	for (int rows = 0; rows < BOARD_LIMIT; rows++)
	{
		for (int cols = 0; cols < BOARD_LIMIT; cols++)
		{
				std::cout << this->_board[rows][cols]->getLetter() << " ";

		}
		std::cout << std::endl;
	}
}
piece* board::getPieceAt(int x, int y) const {
		return this->_board[y][x];
}
char board::getPieceColor(int x, int y) const {
	piece* targetPiece = getPieceAt(x, y);
	if (targetPiece) {
		char letter = targetPiece->getLetter();
		if (!std::isupper(letter)) {
			return 'W';
		}
		else {
			return 'B';
		}
	}
	return ' ';
}
void board::setPieceAt(int x, int y, piece* newPiece)
{
	if (x >= 0 && x < BOARD_LIMIT && y >= 0 && y < BOARD_LIMIT) {
		this->_board[x][y] = newPiece;
	}
}

