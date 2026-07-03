#pragma once
#include "IRequestHandler.h"
#include "Requests.h"
#include "Responses.h"
#include "Room.h"
#include "LoggedUser.h"
#include "RoomManager.h"
#include "GameRequestHandler.h"
#include "RequestHandlerFactory.h"
class RequestHandlerFactory;
class RoomMemberRequestHandler:public IRequestHandler
{
public:
	RoomMemberRequestHandler(Room& r,LoggedUser user , RoomManager& manager, RequestHandlerFactory& factory);
	virtual ~RoomMemberRequestHandler()override;
	virtual bool isRequestRelevant(const RequestInfo& req)const override;
	virtual struct RequestResult handleRequest(const struct RequestInfo& req) override;
private:
	Room& _room;
	LoggedUser _user;
	RoomManager& _manager;
	RequestHandlerFactory& _factory;
	struct RequestResult leaveRoom(const struct RequestInfo& resp);
	struct RequestResult getRoomState(const struct RequestInfo& resp);
};

