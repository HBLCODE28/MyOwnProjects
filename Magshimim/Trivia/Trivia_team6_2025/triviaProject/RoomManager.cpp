#include <iostream>
#include <vector>
#include "RoomManager.h"
RoomManager::RoomManager(IDatabase* db) 
{
	this->_db = db;
}
RoomManager::~RoomManager() 
{
}

int RoomManager::createRoom(LoggedUser user  , struct RoomData data )
{
	data.roomNumber = this->_db->getLastGamePlayed();
	Room room(data,user);
	
	std::lock_guard<std::shared_mutex> room_lock(this->_roomMutex);
	this->_activeRooms.insert({ data.roomNumber,room });
	return data.roomNumber;
}
void RoomManager::deleteRoom(int roomNumber)
{
	std::lock_guard<std::shared_mutex> roomLock(this->_roomMutex);
	for (auto it = this->_activeRooms.begin(); it != this->_activeRooms.end(); it++) 
	{
		if (it->first == roomNumber)
		{
			this->_activeRooms.erase(it);
			return;
		}
	}
}
bool RoomManager::getRoomState(int room)
{
	std::shared_lock<std::shared_mutex> readRoomLock(this->_roomMutex);
	for (auto it = this->_activeRooms.begin(); it != this->_activeRooms.end(); it++)
	{
		if (it->first== room)
		{
			return it->second.getIsActive();
		}
	}
	return true; // player will not be able to enter a game if it has started
}
std::vector<Room> RoomManager::getRooms()
{
	std::shared_lock<std::shared_mutex> roomLock(this->_roomMutex);
	std::vector<Room> rooms;
	for (auto it = this->_activeRooms.begin(); it != this->_activeRooms.end(); it++)
	{
		rooms.push_back(it->second);
	}
	roomLock.unlock();
	return rooms;
}
Room& RoomManager::getRoom(int roomId)
{
	for (auto it = this->_activeRooms.begin(); it != this->_activeRooms.end(); it++) 
	{
		if (it->first == roomId)
		{
			return it->second;
		}
	}
	std::exception exp(__FUNCTION__"could not find room id");
	throw exp;
}