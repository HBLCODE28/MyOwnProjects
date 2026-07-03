#include "Pipe.h"
#include <thread>
#include "rook.h"
#include "king.h"
#include "Queen.h"
#include "bishop.h"
#include "gameManager.h"
#include <iostream>

// Console colors
#define RESET "\033[0m"
#define RED "\033[31m"
#define GREEN "\033[32m"
#define YELLOW "\033[33m"
#define BLUE "\033[34m"
#define MAGENTA "\033[35m"
#define CYAN "\033[36m"
#define WHITE "\033[37m"

std::string sendAndReciveGraphics(Pipe p, std::string source, bool changePlayer, gameManager* newGameManager)
{
    std::cout << BLUE << "\nSending to graphics: " << RESET << source << std::endl;
    p.sendMessageToGraphics(const_cast<char*>(source.c_str()));

    if (changePlayer)
    {
        newGameManager->changePlayer();
    }

    std::string msgFromGraphics = p.getMessageFromGraphics();
    if (msgFromGraphics == "quit")
    {
        exit(1);
    }
    std::cout << GREEN << "\nReceived from graphics: " << RESET << msgFromGraphics << std::endl;
    return msgFromGraphics;
}

void main()
{
    Pipe p;
    bool isConnect = p.connect();
    bool changePlayer = false;
    std::string ans;

    while (!isConnect)
    {
        std::cout << RED << "Cannot connect to graphics" << RESET << std::endl;
        std::cout << "Do you want to try again or exit? (0 - try again, 1 - exit): ";
        std::cin >> ans;

        if (ans == "0")
        {
            std::cout << YELLOW << "Trying to connect again..." << RESET << std::endl;
            Sleep(5000);
            isConnect = p.connect();
        }
        else
        {
            p.close();
            return;
        }
    }

    std::string msgFromGraphics = " ";
    std::string initialBoard = "RNBQKBNRPPPPPPPP################################pppppppprnbqkbnr1";
    std::string move;
    std::string error_msg;
    int errorType;
    board gameBoard(initialBoard);
    gameManager* newGameManager = new gameManager(initialBoard, gameBoard);

    msgFromGraphics = sendAndReciveGraphics(p, initialBoard, changePlayer, newGameManager);

    while (true)
    {
        newGameManager->setMove(msgFromGraphics);

        if (!newGameManager->checkIfLegal())
        {
            errorType = newGameManager->getErrorType();
            error_msg = std::to_string(errorType) + "\0";
            std::cout << RED << "\nError message: " << RESET << error_msg << std::endl;
            changePlayer = false;
            msgFromGraphics = sendAndReciveGraphics(p, error_msg, changePlayer, newGameManager);
        }
        else
        {
            newGameManager->movePiece(newGameManager->get_oldMoveX(), newGameManager->get_oldMoveY(), newGameManager->get_newMoveX(), newGameManager->get_newMoveY());
            errorType = newGameManager->getErrorType();
            std::cout << MAGENTA << "\nMove successful, error type: " << RESET << errorType << std::endl;
            changePlayer = true;
            msgFromGraphics = sendAndReciveGraphics(p, std::to_string(errorType), changePlayer, newGameManager);
            newGameManager->setMove(msgFromGraphics);
        }
        

        newGameManager->printBoard();
    }
}
