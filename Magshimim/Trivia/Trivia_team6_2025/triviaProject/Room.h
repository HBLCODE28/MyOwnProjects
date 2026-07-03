#pragma once
#include <iostream>
#include <vector>
#include <shared_mutex>
#include "LoggedUser.h"
struct RoomData
{
public:

	bool isActive;
	int numOfQuestions;
	int roomNumber;
	int maxPlayers;
	int averageTimeForAQuestion;
	std::vector<std::string> users;
	std::string roomName;
	struct RoomData* operator=(struct RoomData* data)
	{
		isActive = data->isActive;
		numOfQuestions = data->numOfQuestions;
		roomNumber = data->roomNumber;
		maxPlayers = data->maxPlayers;
		users = data->users;
		roomName = data->roomName;
		return this;
	}
};
class Room 
{
	private:
		RoomData _roomData;
		std::shared_mutex _userMutex;
		std::shared_mutex _statusMtx;
	public:
		Room(const struct RoomData& data, LoggedUser user);
		
		Room(const Room& rm);
		
		~Room();
		int getNumOfQuestions();
		int getRoomNumber();
		void setRoomNumber(int roomNumber);
		void setRoomName(std::string roomName);
		int getMaxPlayers();
		int getAverageTimeForAQuestion();
		void setMaxPlayers(int maxPlayers);
		void setAverageTimeForAQuestion(int AverageTimeForAQuestion);
		void setIsActive(bool isActive);
		void removeUser(std::string user);
		bool addUser(std::string user);
		bool getIsActive();
		std::string getRoomName();
		std::vector<std::string> getAllUsers();
		struct RoomData getWholeRoom();
		Room& operator=(RoomData& data);
		//Room* operator=( Room* rm);
		Room& operator=(Room& rm);
		//Room* operator=(Room rm);
		Room& operator=(Room&& rm);
};
