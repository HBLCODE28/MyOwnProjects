#pragma once
#include "Room.h"
#include "LoggedUser.h"
#include "RoomManager.h"
#include "RequestHandlerFactory.h"
#include "Requests.h"
#include "IRequestHandler.h"
#include "GameRequestHandler.h"
class RequestHandlerFactory;
class RoomAdminRequestHandler:public IRequestHandler
{
private:
	Room& m_room;
	LoggedUser m_user;
	RequestHandlerFactory& m_factory;
	RoomManager& m_rManager;

	struct RequestResult closeRoom(const struct RequestInfo& request);
	struct RequestResult startGame(const struct RequestInfo& request);
	struct RequestResult getRoomState(const struct RequestInfo& request);
public:
	RoomAdminRequestHandler(LoggedUser user, RoomManager& rManager, RequestHandlerFactory& m_factory, Room& room);
	virtual ~RoomAdminRequestHandler();

	virtual bool isRequestRelevant(const struct RequestInfo& info)const override;
	virtual RequestResult handleRequest(const struct RequestInfo& info) override;
};

