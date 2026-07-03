#include "Room.h"
#include <iostream>
#include <vector>
#include "LoggedUser.h"


Room::Room(const struct RoomData& data, LoggedUser user) 
{
	this->_roomData.averageTimeForAQuestion = data.averageTimeForAQuestion;
	this->_roomData.isActive = false;
	this->_roomData.maxPlayers = data.maxPlayers;
	this->_roomData.numOfQuestions = data.numOfQuestions;
	this->_roomData.users.push_back(user.getUsername()); 
	this->_roomData.roomName = data.roomName;
	this->_roomData.roomNumber = data.roomNumber;
}
Room::Room(const Room& rm)
{
	auto data = rm._roomData;
	this->_roomData.averageTimeForAQuestion = data.averageTimeForAQuestion;
	this->_roomData.isActive = data.isActive;
	this->_roomData.maxPlayers = data.maxPlayers;
	this->_roomData.numOfQuestions = data.numOfQuestions;
	this->_roomData.roomName = data.roomName;
	this->_roomData.roomNumber = data.roomNumber;
	this->_roomData.users = data.users;
}

Room& Room::operator=(RoomData& data) 
{
	this->_roomData.averageTimeForAQuestion = data.averageTimeForAQuestion;
	this->_roomData.isActive = data.isActive;
	this->_roomData.maxPlayers = data.maxPlayers;
	this->_roomData.numOfQuestions = data.numOfQuestions;
	this->_roomData.roomName = data.roomName;
	this->_roomData.roomNumber = data.roomNumber;
	this->_roomData.users = data.users;
	return *this;
}

Room::~Room()
{
}

Room& Room::operator=(Room&& rm) 
{
	this->_roomData = rm._roomData;
	return *this;
}
int Room::getNumOfQuestions()
{
	return this->_roomData.numOfQuestions;
}

int Room::getRoomNumber()
{
	return this->_roomData.roomNumber;
}
void Room::setRoomNumber(int roomNumber)
{
	this->_roomData.roomNumber = roomNumber;
}

std::string Room::getRoomName()
{
	return this->_roomData.roomName;
}
void Room::setRoomName(std::string roomName) 
{
	this->_roomData.roomName = roomName;
}

int Room::getMaxPlayers() 
{
	return this->_roomData.maxPlayers;
}
void Room::setMaxPlayers(int maxPlayers) 
{
	this->_roomData.maxPlayers = maxPlayers;
}

int Room::getAverageTimeForAQuestion() 
{
	return this->_roomData.averageTimeForAQuestion;
}
void Room::setAverageTimeForAQuestion(int AverageTimeForAQuestion)
{
	this->_roomData.averageTimeForAQuestion = AverageTimeForAQuestion;
}

bool Room::getIsActive()
{
	std::shared_lock<std::shared_mutex> lock(this->_statusMtx);
	return this->_roomData.isActive;
}
void Room::setIsActive(bool isActive) 
{
	std::lock_guard<std::shared_mutex> lock(this->_statusMtx);
	this->_roomData.isActive = isActive;
}


bool Room::addUser(std::string user)
{
	std::lock_guard<std::shared_mutex> userLock(this->_userMutex);
	if (this->_roomData.users.size() == this->_roomData.maxPlayers)
	{
		return false;
	}
	this->_roomData.users.push_back(user);
	return true;
}

void Room::removeUser(std::string user)
{
	std::lock_guard<std::shared_mutex> usersLock(this->_userMutex);
	this->_roomData.users.erase(std::remove_if(this->_roomData.users.begin(), this->_roomData.users.end(), [user](std::string currUser) {return user == currUser; }), this->_roomData.users.end());
}

std::vector<std::string> Room::getAllUsers()
{
	
	std::shared_lock<std::shared_mutex> userLock(this->_userMutex);
	std::vector<std::string> users;
	for (std::string u : this->_roomData.users) {
		users.push_back(u);
	}
	return users;
}
struct RoomData Room::getWholeRoom()
{
	return this->_roomData;
}
