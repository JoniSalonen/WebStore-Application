#ifndef ADMINLOGIN_H
#define ADMINLOGIN_H

#include <QMainWindow>
#include <QtNetwork/QNetworkAccessManager>
#include <QLineEdit>

QT_BEGIN_NAMESPACE
namespace Ui {
class AdminLogin;
}
QT_END_NAMESPACE

class AdminLogin : public QMainWindow
{
    Q_OBJECT

public:
    AdminLogin(QWidget *parent = nullptr);
    ~AdminLogin();

private slots:
    void login();

private:
    Ui::AdminLogin *ui;
    QNetworkAccessManager *manager;

    QLineEdit *passwordEdit;
    QLineEdit *emailEdit;



};
#endif // ADMINLOGIN_H
