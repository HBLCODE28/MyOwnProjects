#include "RequestHandlerFactory.h"
#include "json.hpp"
#include "SqliteDatabase.h"
#define SUCCESS 'S', 'U', 'C', 'C', 'E', 'S', 'S'
#define USERNAME "username"
#define PASSWORD "password"
using json = nlohmann::json;

RequestHandlerFactory::RequestHandlerFactory(IDatabase* db,RoomManager& manager,LoginManager& logMan,StatisticsManager& statMan,GameManager& gameMan) :m_roomManager(manager),m_statisticsManager(statMan),m_loginManager(logMan),gameManager(gameMan)
{
    this->m_database = db ;
}
RequestHandlerFactory::~RequestHandlerFactory()
{
}


LoginRequestHandler* RequestHandlerFactory::createLoginRequestHandler()
{
    return new LoginRequestHandler(m_loginManager, *this);
}

LoginManager& RequestHandlerFactory::getLoginManager()
{
    return m_loginManager;
}

MenuRequestHandler* RequestHandlerFactory::createMenuRequestHandler(const LoggedUser& user)
{
	MenuRequestHandler* menuHandler = new MenuRequestHandler(user, this->m_roomManager,this->m_statisticsManager,*this);

	return menuHandler;
}


RoomManager& RequestHandlerFactory::getRoomManager()
{
    return m_roomManager;
}
StatisticsManager& RequestHandlerFactory::getStatisticsManager()
{
    return m_statisticsManager;
}

RoomAdminRequestHandler* RequestHandlerFactory::createRoomAdminRequestHandler(LoggedUser user, Room& rm)
{
  
    return new RoomAdminRequestHandler(user, this->m_roomManager, *this,rm);
}                        
                         
RoomMemberRequestHandler*RequestHandlerFactory:: createRoomMemberRequestHandler(LoggedUser user, Room& rm)
{
    RoomMemberRequestHandler* rmMem= new RoomMemberRequestHandler(rm, user, this->m_roomManager, *this);
    return rmMem;
}
GameManager& RequestHandlerFactory::getGameManager()
{
    return this->gameManager;
}
GameRequestHandler* RequestHandlerFactory::createGameRequestHandler(Game& game,LoggedUser user) 
{
    return new GameRequestHandler(game,user,this->gameManager,*this);
}
GameRequestHandler* RequestHandlerFactory::createMemberGameRequestHandler(unsigned int gameId, LoggedUser user) 
{
    return new GameRequestHandler(this->gameManager.getGame(gameId), user, this->gameManager, *this);
}