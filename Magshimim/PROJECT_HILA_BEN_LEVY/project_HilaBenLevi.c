#include <stdio.h>
#include <time.h>
#include <conio.h>
#include <stdbool.h>
#include <stdlib.h>
#define MAX 6
#define MAX_RANDOM 25
#define MIN_RANDOM 5
#define MIN 1
#define TEN 10
int app_sum_misses(int sum_misses);
int number_misses(int sum_misses,int user_digit,int secret_digit_1,int secret_digit_2,int secret_digit_3); //בודק על כל ספרה בנפרד של המשתמש אם היא שווה לספרות של המספר הסודי//
int check_if_misses(int user_number,int secret_number);
int calculate_Digits(int user_number,int secret_number);	
int calculate_unity(int user_number,int secret_number);	
int calculate_tens(int user_number,int secret_number);	
int calculate_hundreds(int user_number,int secret_number);	
int calculate_thousands(int user_number,int secret_number);	
int route(int trys,int secret_number,bool is_crazy);
int route_crazy(int secret_number);


int app_sum_hits(int hits);	
int app_sum_misses(int misses);
int attempts_no_normal(int random_num);	
int secret_number_fuction(int secret_number);	
int calculator_number();
int guess(int x,int secret_number, bool is_crazy);
int guess_crazy(int l,int secret_number);
int menu(); 

int main()
{
		char choose_user=' ';
		menu();//prints the game//
		printf("\n");
		printf("would you like to play again?{y/n}:\n"); //ask the user if they want to play again//
		choose_user=getch();
		putchar(choose_user);
		while(choose_user!='y'&&choose_user!='n') //check if the user didn't wrote 'y' or 'n'//
		{
			printf("\n");
			printf("would you like to play again?{y/n}:\n");
			choose_user=getch();
			putchar(choose_user);
		}
		if (choose_user=='y')//check if the user  wrote 'y' //
		{
			printf("\n");
			menu(); //prints the game over again//
		}
		if (choose_user=='n')//check if the user  wrote 'n'//
		{
			printf("\n");
			printf("Bye,have a nice day");
		}
		
}

/*
print the start of the game and get the level the user choice and call to the function of the level
input:none
Output:nonoe
*/
int menu()
{
	int level_chosen = 0;
	int i = 0;
	int secret_number = 0;
	int crazy_number=0;

	                                                                                    
	printf("-----------------------------------------\n");
	printf("Welcome , I have something to tell you \n");
	printf("Okay, so Pancratius, who's like Antiochus's relative, has this secret code for his credit card. And you? You gotta figure out that code to stop him!\n");
	printf("\n");
	printf("Here's the deal:\n");		
	printf("\n");
	printf("Every round, try to guess the secret code (four numbers, between 1-6).\n");
	printf("After each try, you get two hints:\n");
	printf("HITS: Right-on numbers you guessed.\n");
	printf("MISSES: Numbers in the code but not in the right order.\n");
	printf("If you can't guess the code in a few tries, Pancratius is gonna go crazy buying Hanukkah gifts!\n");
	printf("Now, tell me, which level you wanna play?\n");
	printf("1 - Easy  (20 turns)\n");
	printf("2 - mid (15 turns)\n");
	printf("3 - hard (10 turns)\n");
	printf("4 - Super crazy (random turns between 5 and 25)\n");
	
	 do {
            
			printf("Choose 1-4:"); 
			scanf("%d", &level_chosen); 

			if(level_chosen>0 && level_chosen<5) //check if the number in range//
			{
			    break;
			    
			} else {
			    printf("Can only choose 1-4! \n");  
			}
            while (getchar() != '\n'); //we do this to clean buffer coz it is not cleared automaticlay after enter//
    } while (true); 
	
	secret_number = secret_number_fuction(secret_number);
	switch (level_chosen)	//check which level the user chose//
	{
		case 1: //if they chose easy route//
			route(20,secret_number,0); 
			break;
		case 2: //if they chose medium route//
			route(15,secret_number,0);
			break;
		case 3: //if they chose hard route//
			route(10,secret_number,0);
			break;
		case 4: //if they chose crazy route//
			route_crazy(crazy_number);
			route(crazy_number,secret_number,1);
			break;
	}
}

/*
the fuction randomize number that every digit is between 1-6
input:number (equal to zero)
Output:the secret number
*/
int secret_number_fuction(int secret_number)
{
	int secret_number_rand = 0;
	int i=0;
	srand(time(NULL));
	for (i = 1; i <= 4; i++) //a for loop that runs 4 times to get four digits//
	{
		secret_number_rand = rand() % (MAX + 1 - MIN) + MIN;	//reaches a random number between 1-6//
		secret_number = secret_number *TEN + secret_number_rand;	//multiply the number before by ten and add the digit//

	}

	return secret_number;
}


/*
The function repeatedly calls the guess function based on the number of tries, to guess a secret number in a game, and prints a message if the player fails to guess correctly within the given attempts.
input:number of tries,secret number,if the route is crazy
Output:none
*/

int route(int trys,int secret_number,bool is_crazy)
{
	int i=0;
	for (i = trys; i >=1 ; i--) //a for loop that runs according to the number of attempts//
	{
		i=guess(i,secret_number,is_crazy);//go to fuction guess//
	}
	if (i==0)
	{
		printf("Pancratius won :'( ");
		printf("The secret number was %d",secret_number);
	}
}
/*
print how much guess left and how much hits and misses the user got
input:how much guess are and the secret number
Output:how much guess left(if its not crazy route)
*/

int guess(int x,int secret_number, bool is_crazy) 
{
		char user_number_ch_1 =' ';
		char user_number_ch_2 =' ';
		char user_number_ch_3 =' ';
		char user_number_ch_4=' ';
		int user_number = 0;
		bool digits_check=0,tens_check=0,hundreds_check=0,thousands_check=0;
		int sum_misses=0,hits=0;
		while(user_number>6666 || user_number<1111) //check if the number is in the range//
		{
			printf("Write your guess (only 1-6, no ENTER is needed)\n");
			if(!is_crazy)
			{				
				printf("%d guesses left\n", x);
			}
			user_number_ch_1 = getch();
			putchar(user_number_ch_1); 
			user_number_ch_2 = getch();
			putchar(user_number_ch_2); 
			user_number_ch_3 = getch();
			putchar(user_number_ch_3);
			user_number_ch_4 = getch();
			putchar(user_number_ch_4); 
			printf("\n");
			user_number = (user_number_ch_1 - '0') * 1000 + (user_number_ch_2 - '0') * 100 + (user_number_ch_3 - '0') * 10 + (user_number_ch_4 - '0');
			digits_check = calculate_Digits(user_number, secret_number);
			tens_check = calculate_tens(user_number, secret_number);
			hundreds_check = calculate_hundreds(user_number, secret_number);
			thousands_check = calculate_thousands(user_number, secret_number);	
			if (user_number>6666 || user_number<1111)
			{
				printf("Only 1-6 are allowed, try again!\n");
			}
		}	
		
		if (!(digits_check&&tens_check&&hundreds_check&&thousands_check)) //if not every digit equals//
		{
			if (digits_check) //if digits of both numbers(user number and secret number) equals//
			{
				hits=app_sum_hits(hits); //get the hits sum//
			}
			if (tens_check) //if tens of both numbers(user number and secret number) equals//
			{
				hits=app_sum_hits(hits); //get the hits sum//
			}
			
			if (hundreds_check) //if hundreds of both numbers(user number and secret number) equals//
			{
				hits=app_sum_hits(hits); //get the hits sum//
			}
			if (thousands_check) //if thousands of both numbers(user number and secret number) equals//
			{
				hits=app_sum_hits(hits); //get the hits sum//
			}
			if (!(digits_check&&tens_check&&hundreds_check&&thousands_check)) //if not every digit equals//
			{
				sum_misses=check_if_misses(user_number,secret_number); //get the misses sum//
			}
			
			printf("You got  %d HITS  %d MISSES.\n",hits,sum_misses);
			
		}
		else
		{
			printf("You guessed it in %d only guesses! You're like a pro code cracker!\n",x);
			x=-1;	
		}
	return x;	
		
}

/*
the CRAZY route
input:the secret number
Output:none
*/
int route_crazy(int secret_number)
{
	int c = 0, trys = 0;
	trys = attempts_no_normal(trys); //get the number of attempts//
	bool is_crazy=1;
	route(trys,secret_number,is_crazy);
	
}


/*
the random attempts
input:the random number (equal to zero)
Output:the random number(after randomize)
*/
int attempts_no_normal(int random_num)
{
	random_num=rand() % (MAX_RANDOM + 1 - MIN_RANDOM) + MIN_RANDOM; //get the random number//
	return random_num;
}





/*
calculate the Digits of number the user choose and the secret number
input:number the user choose and the secret number
Output:if the Digits equals
*/
int calculate_Digits(int user_number,int secret_number) 
{
	int user_digit = 0, secret_digit = 0;
	user_digit = user_number % TEN;
	secret_digit = secret_number % TEN;
	return user_digit == secret_digit; 

}

/*
calculate the tens of number the user choose and the secret number
input:number the user choose and the secret number
Output:if the tens equals
*/
int calculate_tens(int user_number,int secret_number)
{
	int user_tens = 0, secret_tens = 0;
	user_tens = (user_number / TEN) % TEN;
	secret_tens = (secret_number / TEN) % TEN;
	return user_tens == secret_tens;


}

/*
calculate the hundreds of number the user choose and the secret number
input:number the user choose and the secret number
Output:if the hundreds equals
*/
int calculate_hundreds(int user_number,int secret_number) 
{
	int user_hundreds = 0, secret_hundreds = 0;
	user_hundreds = (user_number / 100) % TEN;
	secret_hundreds = (secret_number / 100) % TEN;
	return user_hundreds == secret_hundreds; 


}

/*
calculate the thousands of number the user choose and the secret number
input:number the user choose and the secret number
Output:if the thousands equals
*/
int calculate_thousands(int user_number,int secret_number) 
{
	int user_thousands = 0, secret_thousands = 0;
	user_thousands = user_number / 1000;
	secret_thousands = secret_number / 1000;
	return user_thousands == secret_thousands; 

}




/*
check if there are misses(Numbers in the code but not in the right order)
input:user number,secret number
Output:misses sum 
*/
int check_if_misses(int user_number,int secret_number) 
{
	int user_thousands = 0, secret_thousands = 0;
	int user_hundreds = 0, secret_hundreds = 0;
	int user_tens = 0, secret_tens = 0;
	int user_digit = 0, secret_digit = 0;
	int sum_misses=0;
	user_digit = user_number % TEN; //find the user number digits//
	secret_digit = secret_number % TEN; //find the secret number digits//
	user_tens = (user_number / TEN) % TEN;//find the user number tens //
	secret_tens = (secret_number / TEN) % TEN;//find the secret number tens //
	user_hundreds = (user_number / 100) % TEN;//find the user number hundreds //
	secret_hundreds = (secret_number / 100) % TEN;//find the secret number hundreds //
	user_thousands = user_number / 1000;//find the user number thousands //
	secret_thousands = secret_number / 1000;//find the secret number thousands //
	if (user_digit==user_tens||user_digit==user_hundreds||user_digit==user_thousands)
	{
		sum_misses=number_misses(sum_misses,user_digit,secret_tens,secret_hundreds,secret_thousands);  //go to number_misses fuction//
	}
	else if (user_tens==user_hundreds||user_tens==user_thousands)
	{
		sum_misses=number_misses(sum_misses,user_tens,secret_digit,secret_hundreds,secret_thousands);//go to number_misses fuction//
	}
	else if (user_hundreds==user_thousands)
	{
		sum_misses=number_misses(sum_misses,user_hundreds,secret_digit,secret_tens,secret_thousands);//go to number_misses fuction//
	}
	else
	{
		sum_misses=number_misses(sum_misses,user_digit,secret_tens,secret_hundreds,secret_thousands);
		sum_misses=number_misses(sum_misses,user_tens,secret_digit,secret_hundreds,secret_thousands);//go to number_misses fuction//
		sum_misses=number_misses(sum_misses,user_hundreds,secret_digit,secret_tens,secret_thousands);//go to number_misses fuction//
		sum_misses=number_misses(sum_misses,user_thousands,secret_digit,secret_tens,secret_hundreds);//go to number_misses fuction//
	}
	
	return sum_misses;

}


/*
raises the misses value by one(check if one of the digits in user number equal to one of  the digits in secret number)
input:one of the digits in user number,all the digits in secret number
Output:misses sum 
*/
int number_misses(int sum_misses,int user_digit,int secret_digit_1,int secret_digit_2,int secret_digit_3) //בודק על כל ספרה בנפרד של המשתמש אם היא שווה לספרות של המספר הסודי//
{
	if (user_digit==secret_digit_1) //check if one of the digits in user number equal to one of  the digit in secret number//
	{
		sum_misses=app_sum_misses(sum_misses);// raises the misses value by one//
	}
	else if (user_digit==secret_digit_2)
	{
		sum_misses=app_sum_misses(sum_misses);; // raises the misses value by one//
	}
	else if (user_digit==secret_digit_3)
	{
		sum_misses=app_sum_misses(sum_misses); // raises the misses value by one//
	}
	
	else if (sum_misses<0)
	{
		sum_misses=0; 
	}
	return sum_misses;
}

/*
raises the misses value by one
input:misses
Output:misses sum 
*/
int app_sum_misses(int sum_misses)
{
	sum_misses+=1; //raises the misses value by one//
	return sum_misses;
}



/*
raises the hits value by one
input:hits
Output:hits sum 
*/
int app_sum_hits(int hits)
{
	hits+=1; //raises the hits value by one//
	return hits;
}




