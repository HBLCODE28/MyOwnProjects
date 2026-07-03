#include "RoomMemberRequestHandler.h"
#include "IRequestHandler.h"
#include "Responses.h"
#include "JsonResponsePacketSerializer.h"
#include "GameRequestHandler.h"
#include "Game.h"
RoomMemberRequestHandler::RoomMemberRequestHandler(Room& r, LoggedUser user, RoomManager& manager, RequestHandlerFactory& factory) :IRequestHandler(), _user(user.getUsername()), _factory(factory), _manager(manager), _room(r)
{
}
RoomMemberRequestHandler::~RoomMemberRequestHandler() 
{
}
bool RoomMemberRequestHandler::isRequestRelevant(const struct RequestInfo& req) const
{
	switch (req.id)
	{
	case  getRoomStateResponse:
	case leaveRoomResponse:
		return true;
		break;
	}
	return false;
}
struct RequestResult RoomMemberRequestHandler::handleRequest(const struct RequestInfo& req)
{
	struct RequestResult res;
	res.newHandler = nullptr;
	switch (req.id)
	{
	case getRoomStateResponse:
		res = this->getRoomState(req);
		break;
	case leaveRoomResponse:
		res = this->leaveRoom(req);
	
	}
	return res;
}
struct RequestResult RoomMemberRequestHandler::leaveRoom(const struct RequestInfo& req) 
{
	this->_manager.deleteRoom(this->_room.getRoomNumber());
	struct LeaveRoomResponse resp;
	resp.status = generalSuccessResponse;
	struct RequestResult res;
	res.newHandler = this->_factory.createMenuRequestHandler(this->_user);
	res.buffer = JsonResponsePacketSerializer::serializeLeaveRoomResponse(resp);
	return res;
}

struct RequestResult RoomMemberRequestHandler::getRoomState(const struct RequestInfo& resp) 
{
	struct RequestResult res;
	struct GetRoomStateResponse  state;
	state.answerTimeOut = this->_room.getAverageTimeForAQuestion();
	state.hasGameBegun = this->_manager.getRoomState(this->_room.getRoomNumber()); // gets the state of the room
	state.players=this->_room.getAllUsers();
	state.questionCount = this->_room.getNumOfQuestions();
	state.status = generalSuccessResponse;
	res.buffer = JsonResponsePacketSerializer::serializeGetRoomStateResponse(state);
	if (state.hasGameBegun)
	{
		res.newHandler = this->_factory.createMemberGameRequestHandler(this->_room.getRoomNumber(),this->_user);
	}
	else 
	{
		res.newHandler = nullptr;
	}
	return res;
}
