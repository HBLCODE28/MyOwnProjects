#pragma once
enum SignUpStatus 
{
	signupError =2,
	successfulSignUp=0,
	userExists=1
};
enum LoginStatus 
{
	userDoesNotExist=2,
	successfulLogin=0,
	userLoggedIn=1,
	wrongPassword =3
};