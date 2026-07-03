#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <stdbool.h>
#include <ctype.h>

#define BUFFER_SIZE 255
#define MAX_FILES 1000

typedef struct {
    char* result;
} ScanResult;

ScanResult scanResults[MAX_FILES];
int resultCount = 0;

void scanFiles(const char* basePath, FILE* virusSignature, bool quickScan);
void scanSegment(FILE* file, FILE* virusSignature, const char* fileName, bool quickScan);
long int findSize(const char* file_path);
int compare(const void* a, const void* b);
void freeResources();
bool isValidNumber(const char* str);
void addScanResult(const char* result);

int main(int argc, char* argv[]) {
    if (argc < 3) {
        printf("Usage: %s <directory to scan> <virus signature file>\n", argv[0]);
        return 1;
    }

    char* foldername = argv[1];
    char* filename = argv[2];
    FILE* virusSignature = fopen(filename, "r");
    if (!virusSignature) {
        perror("Failed to open virus signature file");
        return 1;
    }

    FILE* logFile = fopen("AntiVirusLog.txt", "w");
    if (!logFile) {
        perror("Failed to open log file");
        fclose(virusSignature);
        return 1;
    }

    int scanType;
    printf("Welcome to my Virus Scan!\n");
    printf("Folder to scan: %s\n", foldername);
    printf("Virus signature: %s\n", filename);
    printf("Press 0 for a normal scan or any other key for a quick scan: ");
    if (scanf("%d", &scanType) != 1) {
        printf("Invalid input. Use 0 for normal scan and any other key for quick scan.\n");
        fclose(logFile);
        fclose(virusSignature);
        return 1;
    }
    bool quickScan = scanType != 0;

    fprintf(logFile, "Anti-virus began! Welcome!\n");
    fprintf(logFile, "Folder to scan: \n%s\n", foldername);
    fprintf(logFile, "Virus signature: \n%s\n", filename);
    fprintf(logFile, "Scanning option:\n%s Scan\n\n", quickScan ? "Quick" : "Normal");

    printf("Scanning began...\nThis process may take several minutes...\nScanning:\n");

    scanFiles(foldername, virusSignature, quickScan);

    qsort(scanResults, resultCount, sizeof(ScanResult), compare);

    fprintf(logFile, "Results:\n");
    for (int i = 0; i < resultCount; i++) {
        fprintf(logFile, "%s\n", scanResults[i].result);
        printf("%s\n", scanResults[i].result);
    }

    printf("Scan Completed.\n");
    printf("See log path for results: AntiVirusLog.txt\n");

    fclose(logFile);
    fclose(virusSignature);
    freeResources();

    return 0;
}

/**
 * Adds a scan result to the global scanResults array.
 * @param result The result string to add.
 */
void addScanResult(const char* result) {
    if (resultCount >= MAX_FILES) {
        fprintf(stderr, "Exceeded maximum number of files to scan.\n");
        exit(1);
    }
    scanResults[resultCount].result = strdup(result);
    if (!scanResults[resultCount].result) {
        fprintf(stderr, "Memory allocation error\n");
        exit(1);
    }
    resultCount++;
}

/**
 * Scans all files in the given directory and its subdirectories for the virus signature.
 * @param basePath The base directory to scan.
 * @param virusSignature The file pointer to the virus signature.
 * @param quickScan A flag indicating whether to perform a quick scan or not.
 */
void scanFiles(const char* basePath, FILE* virusSignature, bool quickScan) {
    DIR* d = opendir(basePath);
    if (!d) {
        fprintf(stderr, "Failed to open directory %s\n", basePath);
        return;
    }

    struct dirent* entry;
    while ((entry = readdir(d)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;

        char path[1024];
        snprintf(path, sizeof(path), "%s/%s", basePath, entry->d_name);

        struct stat path_stat;
        if (stat(path, &path_stat) != 0) {
            fprintf(stderr, "Failed to access %s\n", path);
            continue;
        }

        if (S_ISDIR(path_stat.st_mode)) {
            scanFiles(path, virusSignature, quickScan);
        } else if (S_ISREG(path_stat.st_mode)) {
            FILE* file = fopen(path, "r");
            if (!file) {
                fprintf(stderr, "Failed to open %s\n", path);
                continue;
            }

            scanSegment(file, virusSignature, path, quickScan);
            fclose(file);
        }
    }
    closedir(d);
}

/**
 * Scans a file for the virus signature. In quick scan mode, only the first and last 20% of the file are scanned.
 * @param file The file pointer to the file being scanned.
 * @param virusSignature The file pointer to the virus signature.
 * @param fileName The name of the file being scanned.
 * @param quickScan A flag indicating whether to perform a quick scan or not.
 */
void scanSegment(FILE* file, FILE* virusSignature, const char* fileName, bool quickScan) {
    char bufferFile[BUFFER_SIZE];
    bool infected = false;
    long size = findSize(fileName);
    if (size == -1) {
        fprintf(stderr, "Failed to determine the size of %s\n", fileName);
        return;
    }

    long first20percent = size * 0.2;
    long last20percent = size * 0.8;
    long currentPos = 0;

    fseek(file, 0, SEEK_SET);

    while (fgets(bufferFile, BUFFER_SIZE, file) != NULL && !infected) {
        currentPos = ftell(file) - strlen(bufferFile);

        if (quickScan && (currentPos > first20percent && currentPos < last20percent)) {
            fseek(file, last20percent, SEEK_SET);
            continue;
        }

        rewind(virusSignature);
        char bufferVirus[BUFFER_SIZE];

        while (fgets(bufferVirus, BUFFER_SIZE, virusSignature) != NULL) {
            bufferVirus[strcspn(bufferVirus, "\n")] = 0;

            if (strstr(bufferFile, bufferVirus)) {
                infected = true;
                char result[BUFFER_SIZE + 100];
                snprintf(result, sizeof(result), "%s - Infected! (%s)", fileName, currentPos <= first20percent ? "first 20%" : "last 20%");
                addScanResult(result);
                break;
            }
        }
    }

    if (!infected) {
        char result[BUFFER_SIZE + 100];
        snprintf(result, sizeof(result), "%s - Clean", fileName);
        addScanResult(result);
    }
}

/**
 * Finds the size of the given file.
 * @param file_path The path to the file.
 * @return The size of the file in bytes, or -1 if the file could not be opened.
 */
long int findSize(const char* file_path) {
    struct stat st;
    if (stat(file_path, &st) != 0) {
        return -1;
    }
    return st.st_size;
}

/**
 * Comparison function for sorting ScanResult structures alphabetically by result string.
 * @param a Pointer to the first ScanResult.
 * @param b Pointer to the second ScanResult.
 * @return A negative value if a < b, zero if a == b, or a positive value if a > b.
 */
int compare(const void* a, const void* b) {
    ScanResult* resultA = (ScanResult*)a;
    ScanResult* resultB = (ScanResult*)b;
    return strcmp(resultA->result, resultB->result);
}

/**
 * Frees the memory allocated for the scan results.
 */
void freeResources() {
    for (int i = 0; i < resultCount; i++) {
        free(scanResults[i].result);
    }
}

/**
 * Checks if the given string represents a valid number.
 * @param str The string to check.
 * @return True if the string is a valid number, false otherwise.
 */
bool isValidNumber(const char* str) {
    while (*str) {
        if (!isdigit(*str)) return false;
        str++;
    }
    return true;
}
