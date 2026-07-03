#pragma once
#include "board.h"
#include "piece.h"
#include "nothing.h"
enum errorType
{
	LegalMove = 0,
	checkOnKing = 1,
	noCurrentPlayerPiece = 2,
	destSameColor = 3,
	makeSelfCheck = 4,
	illegalIndex = 5,
	illegalPieceMove = 6,
	samePlace = 7,
	checkMate = 8,
};
class piece;

class gameManager
{
public:
	gameManager(std::string string_board,board& gameBoard);
	void movePiece(int old_location_x, int old_location_y, int new_location_x, int new_location_y);
	void removePiece(int location_x, int location_y);
	void setMove(std::string move);
	int get_oldMoveX();
	int get_oldMoveY();
	int get_newMoveX();
	int get_newMoveY();
	int get_player();
	void changePlayer();
	bool checkIfLegal();
	int getErrorType();
	void printBoard();
private:
	std::string _move;
	int _player;
	int _oldMoveX;
	int _oldMoveY;
	int _newMoveX;
	int _newMoveY;
	board& _gameBoard;
	int _error_msg;
};
