#include "rook.h"
#define BOARD_LIMIT 8

Rook::Rook(char letter,int location_x, int location_y) : piece(letter,location_x, location_y)
{
	this->_letter = letter;

}
bool Rook::checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y)
{
    if (this->_location_x == new_location_x || this->_location_y == new_location_y)
    {
        return true;
    }
    return false;
}

char Rook::getLetter()
{
	return this->_letter;
}
bool Rook::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
    if (new_location_x == this->_location_x) {
        int start = std::min(_location_y, new_location_y);
        int end = std::max(_location_y, new_location_y);

        for (int i = start + 1; i < end; i++) {
            // piece* blockingPiece = gameBoard.getPieceAt(_location_x, y);
            if (gameBoard.getPieceAt(_location_x, i)->getLetter() != '#') {
                return true;
            }
        }
    }

    if (new_location_y == _location_y) {
        int start = std::min(_location_x, new_location_x);
        int end = std::max(_location_x, new_location_x);

        for (int x = start + 1; x < end; x++) {
            //piece* blockingPiece = gameBoard.getPieceAt(x, _location_y);
            if (gameBoard.getPieceAt(x, _location_y)->getLetter() != '#') {
                return true;
            }
        }
    }
    return false;
}