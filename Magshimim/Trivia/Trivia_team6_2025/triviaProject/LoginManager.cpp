#include "LoginManager.h"
#include <exception>
#include <chrono>
LoginManager::LoginManager( IDatabase* db)
{
	this->_usersMutex;
	this->m_database = db;
	this->m_loggedUsers.clear();

}
LoginManager::~LoginManager()
{
	
}
void LoginManager::logout(const std::string& username)
{
	
	std::lock_guard<std::shared_mutex> usersLock(this->_usersMutex);
	std::cout << "logging out the user: "<<username<<"\n";
	
	for (auto user = this->m_loggedUsers.begin();user!=this->m_loggedUsers.end();user++)
	{
		if (user->getUsername() == username)
		{
			this->m_loggedUsers.erase(user);
			return;
		}
	}
}
/*
	function that logs in the user
	input: username and password
	output: one of the login status codes
	success,failure ,user is already logged in or wrongPassword
*/
LoginStatus LoginManager::login(const std::string& username, const std::string& password)
{

	std::lock_guard<std::shared_mutex> usersLock(this->_usersMutex);// locking here because if a login request comes first 
	//before the logout request on the same user, the expected behaviour is user logs in then logs out
	//but if we will put the lock before the for loop ensuring that there are no changes during iteration
	//the behaviour will be : user logs out then logs in
	if (!this->m_database->doesUserExist(username))
	{
		return userDoesNotExist;
	}
	if (this->m_database->doesPasswordMatch(username, password))
	{
		for (auto user = this->m_loggedUsers.begin();user!=this->m_loggedUsers.end();user++)
		{
			std::cout << "Current user: " << user->getUsername() << "\n";
			if (user->getUsername() == username)
			{
				return userLoggedIn;
			}
		}
		LoggedUser usr(username);
		
		this->m_loggedUsers.push_back(usr);
		return successfulLogin;
	}
	return wrongPassword;
}
/*
	signups the user
	input: username password email
	output: on of the signup statusses
	existing user, successful sign up and error has accured during signup
*/
SignUpStatus LoginManager::signup(const std::string& username , const std::string&password , const std::string& email) 
{
	std::cout << "signing in\n";
	if (this->m_database->doesUserExist(username))
	{
		return userExists;
	}
	if (this->m_database->addNewUser(username, password, email))
	{
		if (successfulLogin != this->login(username, password)) 
		{
			return signupError;
		}
		return successfulSignUp;
	}
	return signupError;
}

const IDatabase* LoginManager::getDatabase()const 
{
	return this->m_database;
}
const std::vector<LoggedUser>& LoginManager::getLoggedUsers()const
{
	return this->m_loggedUsers;
}