#include "nothing.h"
nothing::nothing(char letter, int location_x, int location_y) : piece(letter,location_x,location_y)
{
	this->_letter = letter;
}
bool nothing::checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y)
{
	return false;
}
bool nothing::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
	return true;
}
char nothing::getLetter()
{
	return this->piece_char;
}