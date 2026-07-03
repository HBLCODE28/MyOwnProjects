#include "RequestResult.h"
#include "json.hpp"
#include "Requests.h"
#include "Responses.h"
#include "RequestHandlerFactory.h"
#include "JsonRequestPacketDeserializer.h"
#include "JsonResponsePacketSerializer.h"
#include <algorithm>
using json = nlohmann::json;

MenuRequestHandler::MenuRequestHandler(LoggedUser user , RoomManager& rManager, StatisticsManager& sManager, RequestHandlerFactory& factory):IRequestHandler(),_r_manager(rManager),_statMan(sManager),_factory(factory),_user(user)
{
	
}
MenuRequestHandler::~MenuRequestHandler()
{
}
bool MenuRequestHandler::isRequestRelevant(const RequestInfo& request) const
{
	// ############################################################
	// #                                                          #
	// #  isRequestRelevant – Checks if this is a message code    #
	// #  for one of the following requests:                      #
	// #                                                          #
	// #    • CreateRoomRequest                                   #
	// #    • GetRoomsRequest                                     #
	// #    • GetPlayersInRoomRequest                             #
	// #    • JoinRoomRequest                                     #
	// #    • GetStatisticsRequest                                #
	// #    • LogoutRequest                                       #
	// #                                                          #
	// ############################################################
	switch (request.id)
	{
	case RoomResponse::createRoom:
		return true;
	case RoomResponse::getRooms:
		return true;
	case playersInRoom:
		return true;
	case RoomResponse::joinRoom:
		return true;
	case highScore:
		return true;
	case personalStats:
		return true;
		break;
	case logoutCode:
		return true;
	default:
		return false;
	}
}
RequestResult MenuRequestHandler::handleRequest(const RequestInfo& request)
{
	RequestResult result;
	switch (request.id)
	{
	case RoomResponse::createRoom:
		result = this->createRoom(request);
		break;
	case RoomResponse::getRooms:
		result = this->getRooms(request);
		break;
	case playersInRoom:
		result = this->getPlayersInRoom(request);
		break;
	case RoomResponse::joinRoom:
		result = this->joinRoom(request);
		break;
	case highScore:
		result = this->getHighScore(request);
		break;
	case personalStats:
		result = this->getPersonalStats(request);
		break;
	case logoutCode:
		result = this->logOut(request);
		break;
	}
	return result;
}

RequestResult MenuRequestHandler::logOut(const struct RequestInfo& requestInfo)
{
	RequestResult res;
	res.newHandler = nullptr;
	LoginManager& logMan = this->_factory.getLoginManager();
	logMan.logout(this->_user.getUsername());
	struct LogoutResponse resp;
	resp.status = generalSuccessResponse;
	res.buffer = JsonResponsePacketSerializer::serializeLogoutResponse(resp);
	return res;
}
RequestResult MenuRequestHandler::getRooms(const struct RequestInfo& requestInfo)
{
	RequestResult res; 
	res.newHandler = nullptr;
	std::vector<Room> rooms = this->_r_manager.getRooms();
	std::vector<RoomData> dataRooms;
	for (auto it = rooms.begin(); it != rooms.end(); it++ )
	{
		dataRooms.push_back(it->getWholeRoom());
	}
	GetRoomsResponse resp;
	resp.status = generalSuccessResponse;
	resp.rooms.insert(resp.rooms.begin(), dataRooms.begin(), dataRooms.end());
	res.buffer= JsonResponsePacketSerializer::serializeGetRoomsResponse(resp);
	res.newHandler =nullptr;
	return res;
}
RequestResult MenuRequestHandler::getPlayersInRoom(const struct RequestInfo& requestInfo)
{
	RequestResult res;
	res.newHandler = nullptr;
	GetPlayersInRoomResponse playersResp;
	
	GetPlayersInRoomRequest playersInRoom;
	playersInRoom= JsonRequestPacketDeserializer::deserializeGetPlayersRequest(requestInfo.buffer);
	Room& rm = this->_r_manager.getRoom(playersInRoom.roomId);
	playersResp.players = rm.getAllUsers();
	res.buffer = JsonResponsePacketSerializer::serializeGetPlayersInRoomResponse(playersResp);
	return res;
}
RequestResult MenuRequestHandler::getPersonalStats(const struct RequestInfo& requestInfo)
{
	struct RequestResult res;
	res.newHandler = nullptr;
	
	struct GetPersonalStatsResponse stats;
	stats.stats= this->_statMan.getUserStatistics(this->_user.getUsername());
	stats.status = generalSuccessResponse;
	res.buffer = JsonResponsePacketSerializer::serializeGetPersonalStatsResponse(stats);
	return res; 
}
RequestResult MenuRequestHandler::getHighScore(const struct RequestInfo& requestInfo)
{
	GetHighScoreResponse resp;
	RequestResult res;
	resp.status = generalSuccessResponse;
	resp.stats = this->_statMan.getHighScore();
	res.newHandler = nullptr;
	res.buffer = JsonResponsePacketSerializer::serializeHighScoreResponse(resp);
	return res;
}
RequestResult MenuRequestHandler::joinRoom(const struct RequestInfo& requestInfo)
{
	RequestResult res;
	
	JoinRoomResponse resp;
	resp.status = generalErrorResponse;
	JoinRoomRequest joinReq=JsonRequestPacketDeserializer::deserializeJoinRoomRequest(requestInfo.buffer);
	Room& rm = this->_r_manager.getRoom(joinReq.roomId);
	if (rm.addUser(this->_user.getUsername()))
	{
		res.newHandler = this->_factory.createRoomMemberRequestHandler(this->_user,rm);
		resp.status = generalSuccessResponse;
	}

	res.buffer =JsonResponsePacketSerializer::serializeJoinRoomResponse(resp);
	return res;
}
RequestResult MenuRequestHandler::createRoom(const struct RequestInfo& requestInfo)
{
	RequestResult res;
	
	CreateRoomRequest roomReq = JsonRequestPacketDeserializer::deserializeCreateRoomRequest(requestInfo.buffer);
	struct RoomData data;
	data.isActive = false;
	data.maxPlayers = roomReq.maxUsers;
	data.numOfQuestions = roomReq.questionCount;
	data.roomName = roomReq.roomName;
	data.averageTimeForAQuestion = roomReq.answerTimeout;
	struct CreateRoomResponse resp;
	
	int roomId =this->_r_manager.createRoom(this->_user, data);// when a room is created the function returns the room id
	res.newHandler = this->_factory.createRoomAdminRequestHandler(this->_user, this->_r_manager.getRoom(roomId));
	resp.status= generalSuccessResponse;
	
	res.buffer =JsonResponsePacketSerializer::serializeCreateRoomResponse(resp);
	return res;
}

