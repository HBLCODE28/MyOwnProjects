
#include <iostream>

#include "Server.h"
#include <exception>
#include <vector>
#include "SqliteDatabase.h"
#include "RequestHandlerFactory.h"
#include "RoomManager.h"
#include "StatisticsManager.h"
#include "LoginManager.h"
#include "GameManager.h"
int main()
{
	SqliteDatabase db("test.sqlite");
	LoginManager log_man(&db);
	RoomManager rm_man(&db);
	StatisticsManager stat_man(&db);
	GameManager gameMan(&db);
	RequestHandlerFactory factory(&db,rm_man,log_man,stat_man,gameMan);
	Server sr(&db,factory);
	db.open();
	try
	{
		sr.serve();
	}
	catch (const std::exception& exp)
	{
		std::cout << exp.what();
	}
	db.close();
	return 0;
}