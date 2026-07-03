#pragma once
#include "piece.h"
class Rook : public piece{
public:
	Rook(char letter, int loction_x, int loction_y); //Constructor function
	virtual bool checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y) override;
	virtual char getLetter(); // get the letter value
	virtual bool checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard) override;

private:
	char _letter;
};
