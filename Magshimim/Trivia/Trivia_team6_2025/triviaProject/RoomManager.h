#pragma once
#include "Room.h"
#include <iostream>
#include <vector>
#include "IDatabase.h"
#include "LoggedUser.h"
#include <shared_mutex>
#include <map>
class RoomManager 
{
	private:
		std::map<int, Room> _activeRooms;
		std::shared_mutex _roomMutex;
		IDatabase* _db;
	public:
		RoomManager(IDatabase* db);
		~RoomManager();
		int createRoom(LoggedUser  user , struct RoomData data); // returns the room id
		void deleteRoom(int roomNumber);
		bool getRoomState(int roomId);
		Room& getRoom(int roomId);
		std::vector<Room> getRooms();
};
