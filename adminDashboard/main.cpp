#include "adminlogin.h"
#include <QApplication>

int main(int argc, char *argv[])
{

    QApplication a(argc, argv);
    AdminLogin w;
    w.show();
    return a.exec();
}
