#pragma once
#include <iostream>
#include <vector>
#include "RequestResult.h"
#include "LoginManager.h"
#include "LoginRequestHandler.h"
#include "RoomManager.h"
#include "StatisticsManager.h"
#include "IDatabase.h"
#include "RoomAdminRequestHandler.h"
#include "RoomMemberRequestHandler.h"
#include "GameRequestHandler.h"
#include "GameManager.h"
class LoginRequestHandler;
class RoomAdminRequestHandler;
class RoomMemberRequestHandler;
class GameRequestHandler;
class RequestHandlerFactory
{
public:
      RequestHandlerFactory(IDatabase* db,RoomManager& manager,LoginManager& logMan,StatisticsManager& statMan,GameManager& gManager);
      ~RequestHandlerFactory();
      
      LoginRequestHandler* createLoginRequestHandler();
      MenuRequestHandler* createMenuRequestHandler(const LoggedUser& user);
      GameRequestHandler* createGameRequestHandler(Game& game,LoggedUser user);
      GameRequestHandler* createMemberGameRequestHandler(unsigned int gameId,LoggedUser user);
      RoomMemberRequestHandler* createRoomMemberRequestHandler(LoggedUser user , Room& rm);
      LoginManager& getLoginManager();
      RoomManager& getRoomManager();
      StatisticsManager& getStatisticsManager();
      RoomAdminRequestHandler* createRoomAdminRequestHandler(LoggedUser user,Room& rm);
      GameManager& getGameManager();
private:
    LoginManager& m_loginManager;
    RoomManager& m_roomManager;
    StatisticsManager& m_statisticsManager;
    GameManager& gameManager;
    IDatabase* m_database;
};
