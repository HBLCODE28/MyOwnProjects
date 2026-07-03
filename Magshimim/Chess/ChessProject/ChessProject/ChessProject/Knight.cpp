#include "Knight.h"
Knight::Knight(char letter, int location_x, int location_y) : piece(letter, location_x, location_y)
{
	this->_letter = letter;
}
bool Knight::checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y)
{
    if ((this->_location_x == new_location_x + 2 || this->_location_x == new_location_x - 2) && (this->_location_y == new_location_y - 1 || this->_location_y == new_location_y + 1))
    {
        return true;
    }
    if ((this->_location_y == new_location_y - 2 || this->_location_y == new_location_y + 2) && (this->_location_x == new_location_x - 1 || this->_location_x == new_location_x + 1))
    {
        return true;
    }
    return false;
}
bool Knight::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
    return false;
}
char Knight::getLetter()
{
	return this->_letter;
}