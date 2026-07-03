#include "RoomAdminRequestHandler.h"
#include "Responses.h"
#include "JsonResponsePacketSerializer.h"
#include "json.hpp"
using json =nlohmann::json;

RoomAdminRequestHandler::RoomAdminRequestHandler(LoggedUser user, RoomManager& manager, RequestHandlerFactory& factory, Room& room) : IRequestHandler(),m_room(room), m_user(user.getUsername()), m_rManager(manager), m_factory(factory)
{
	
}
RoomAdminRequestHandler::~RoomAdminRequestHandler() 
{
}
bool RoomAdminRequestHandler::isRequestRelevant(const RequestInfo& request) const
{
	switch (request.id)
	{
	case closeRoomResponse:
	case startGameResponse:
	case getRoomStateResponse:
		return true;
		break;
	}
	return false;
}
struct RequestResult RoomAdminRequestHandler::closeRoom(const struct RequestInfo& request) 
{
	this->m_room.setIsActive(false); // deactivating the room
	this->m_rManager.deleteRoom(this->m_room.getRoomNumber()); // closing the room
	struct CloseRoomResponse closeRm;
	closeRm.status = generalSuccessResponse;
	struct RequestResult res;
	res.buffer = JsonResponsePacketSerializer::serializeCloseRoomResponse(closeRm);
	res.newHandler = nullptr;
	return res;
}
struct RequestResult RoomAdminRequestHandler::startGame(const struct RequestInfo& request) 
{
	this->m_room.setIsActive(true);
	struct RequestResult res;
	struct StartGameResponse startGame;
	startGame.status = generalSuccessResponse;
	res.buffer = JsonResponsePacketSerializer::serializeStartGameResponse(startGame);
	Game& gm = this->m_factory.getGameManager().createGame(this->m_room.getRoomNumber(), this->m_room.getNumOfQuestions());
	res.newHandler = this->m_factory.createGameRequestHandler(gm,this->m_user);
	return res;
}

struct RequestResult RoomAdminRequestHandler::getRoomState(const struct RequestInfo& request) 
{
	struct RequestResult res;
	struct GetRoomStateResponse  state;
	state.answerTimeOut = this->m_room.getAverageTimeForAQuestion();
	state.hasGameBegun = this->m_rManager.getRoomState(this->m_room.getRoomNumber()); // gets the state of the room
	state.players = this->m_room.getAllUsers(); 
	state.questionCount = this->m_room.getNumOfQuestions();
	state.status = generalSuccessResponse;
	res.buffer = JsonResponsePacketSerializer::serializeGetRoomStateResponse(state);
	res.newHandler = nullptr;
	return res;
}
struct  RequestResult RoomAdminRequestHandler::handleRequest(const struct RequestInfo& info) 
{
	struct RequestResult res;
	switch (info.id) 
	{
	case closeRoomResponse:
		res = this->closeRoom(info);
		break;
	case startGameResponse:
		res = this->startGame(info);
		break;
	case getRoomStateResponse:
		res = this->getRoomState(info);
		break;
	}
	return res;
}