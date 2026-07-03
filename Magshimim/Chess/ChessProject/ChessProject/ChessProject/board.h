#ifndef BOARD_H
#define BOARD_H
#include "iostream"
#define BOARD_LIMIT 8
class piece;
class board {
public:
	piece* getPieceAt(int x, int y) const;
	char getPieceColor(int x, int y) const;

	board(std::string string_board);
	void printBoard();
	void initBoard();
	void setPieceAt(int x, int y, piece* newPiece);
protected:
	piece* _board[8][8];
	std::string _board_string;
};

enum ePiece
{
	WHITE_ROOK = 'R',
	black_rook = 'r',
	WHITE_KNIGHT = 'N',
	black_Knight = 'n',
	WHITE_QUEEN = 'Q',
	black_queen = 'q',
	WHITE_KING = 'k',
	black_king = 'K',
	black_bishop = 'b',
	WHITE_BISHOP = 'B',
	black_pawn = 'p',
	WHITE_PAWN = 'P',
	emptySpace = '#',
};
#endif