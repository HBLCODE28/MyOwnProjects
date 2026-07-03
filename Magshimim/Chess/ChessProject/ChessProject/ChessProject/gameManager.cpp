#include "gameManager.h"
gameManager::gameManager(std::string string_board, board& gameBoard) : _gameBoard(gameBoard)
{
	this->_player = 1; //the black player start in the .exe
	this->_oldMoveX = 0;
	this->_oldMoveY = 0;
	this->_newMoveX = 0;
	this->_newMoveY = 0;
	this->_move = " ";
	this->_error_msg = LegalMove;
}
void gameManager::movePiece(int old_location_x, int old_location_y, int new_location_x, int new_location_y)
{
	this->_gameBoard.getPieceAt(old_location_x,old_location_y)->setLocation(new_location_x,new_location_y);
	piece* currentPiece = _gameBoard.getPieceAt(old_location_x, old_location_y);
	removePiece(old_location_x, old_location_y);
	_gameBoard.setPieceAt(new_location_y, new_location_x, currentPiece);
	if (this->_gameBoard.getPieceAt(this->_newMoveX, this->_newMoveY)->checkIfChecksKing(this->_gameBoard, this->_player))
	{
		this->_error_msg = checkOnKing;
	}
}
void gameManager::removePiece(int location_x, int location_y)
{
	piece* new_piece = new nothing('#', location_x, location_y);
	_gameBoard.setPieceAt(location_y, location_x, new_piece);
}
void gameManager::setMove(std::string move)
{
	this->_move = move;
	this->_oldMoveX = (move[0] - 'a');
	this->_oldMoveY = 7 - (move[1] - '0' - 1);
	this->_newMoveX = (move[2] - 'a');
	this->_newMoveY = 7 - (move[3] - '0' - 1);

}
int gameManager::get_oldMoveX()
{
	return this->_oldMoveX;
}
int gameManager::get_oldMoveY()
{
	return this->_oldMoveY;
}
int gameManager::get_newMoveX()
{
	return this->_newMoveX;
}
int gameManager::get_newMoveY()
{
	return this->_newMoveY;
}
void gameManager::changePlayer()
{
	if (this->_player == 1)
	{
		this->_player = 2;
	}
	else
	{
		this->_player = 1;
	}
}
int gameManager::get_player()
{
	return this->_player;
}
bool gameManager::checkIfLegal()
{
	if (this->get_newMoveX() < 0 || this->get_newMoveX() > BOARD_LIMIT)
	{
		this->_error_msg = illegalIndex;
		return false;
	}
	if (this->_gameBoard.getPieceAt(this->_oldMoveX, this->_oldMoveY)->getLetter() == '#') {
		this->_error_msg = noCurrentPlayerPiece;
		return false;
	}
	if (this->_gameBoard.getPieceColor(this->_oldMoveX, this->_oldMoveY) == 'B' && this->_player == 1)
	{
		this->_error_msg = noCurrentPlayerPiece;
		return false;
	}
	if (this->_gameBoard.getPieceColor(this->_oldMoveX, this->_oldMoveY) == 'W' && this->_player == 2)
	{
		this->_error_msg = noCurrentPlayerPiece;
		return false;
	}
	if (this->_gameBoard.getPieceAt(this->_oldMoveX, this->_oldMoveY)->checkIfSamePlace(this->_newMoveX,this->_newMoveY))
	{
		this->_error_msg = samePlace;
		return false;
	}
	if (this->_gameBoard.getPieceColor(this->_oldMoveX, this->_oldMoveY) == 'B' && this->_gameBoard.getPieceColor(this->_newMoveX, this->_newMoveY) == 'B' && this->_gameBoard.getPieceAt(this->_newMoveX, this->_newMoveY)->getLetter() != '#')
	{
		this->_error_msg = destSameColor;
		return false;
	}
	if (this->_gameBoard.getPieceColor(this->_oldMoveX, this->_oldMoveY) == 'W' && this->_gameBoard.getPieceColor(this->_newMoveX, this->_newMoveY) == 'W' && this->_gameBoard.getPieceAt(this->_newMoveX, this->_newMoveY)->getLetter() != '#')
	{
		this->_error_msg = destSameColor;
		return false;
	}
	if (!this->_gameBoard.getPieceAt(this->_oldMoveX, this->_oldMoveY)->checkIfMoveAllowed(this->_gameBoard, this->get_newMoveX(), this->get_newMoveY()))
	{
		this->_error_msg = illegalPieceMove;
		return false;
	}
	if (this->_gameBoard.getPieceAt(this->_oldMoveX, this->_oldMoveY)->checkIfRunsOver(this->get_newMoveX(), this->get_newMoveY(),this->_gameBoard))
	{
		this->_error_msg = illegalPieceMove;
		return false;
	}
	this->_error_msg = LegalMove;
	return true;
}

int gameManager::getErrorType()
{
	return this->_error_msg;
}
void gameManager::printBoard()
{
	this->_gameBoard.printBoard();
}