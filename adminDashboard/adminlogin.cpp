#include "adminlogin.h"
#include "./ui_adminlogin.h"
#include "admindashboardview.h"
#include "envcreator.h"
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QFile>
#include <QDebug>
#include <QLineEdit>
#include <QMessageBox>
#include <QLabel>
#include <QMessageBox>

static QString URL;

AdminLogin::AdminLogin(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::AdminLogin)
{
    ui->setupUi(this);
    setWindowTitle("Login window");

    envCreator env;
    // creates enviroment url variable
    env.createEnvFile();
    URL = env.openEnv();

    manager = new QNetworkAccessManager(this);

    connect(ui->loginBtn, &QPushButton::clicked,this, &AdminLogin::login);

    ui->emailEdit->setPlaceholderText("Email");

    ui->passwordEdit->setPlaceholderText("Password");
    ui->passwordEdit->setEchoMode(QLineEdit::Password);

    // for testin purposes will be removed later!
    // this makes the testing easier, the edit lines are filled already when launching the program
    ui->emailEdit->setText("a@a.com");
    ui->passwordEdit->setText("123456");

}

AdminLogin::~AdminLogin()
{
    delete ui;
}

// Login screen connecting to the database and getting result if the user can proceed
void AdminLogin::login(){
    QUrl url(URL + "auth/login");

    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    // Creating Database post objects body
    QJsonObject body;
    body["email"] = ui->emailEdit->text();
    body["password"] = ui->passwordEdit->text();

    QNetworkReply *reply = manager->post(request,QJsonDocument(body).toJson());

    // Connecting to the database and getting result if the user can continue with the current user
    connect(reply, &QNetworkReply::finished, this, [=](){
        auto response = QJsonDocument::fromJson(reply->readAll()).object();
        QString token = response["accessToken"].toString();

        if(!token.isEmpty()){
            QFile file("token.txt");
            if(file.open(QIODevice::WriteOnly | QIODevice::Truncate)){
                file.write(token.toUtf8());
                file.close();
            }
            // Getting positive result
            AdminDashboardview *dashboard = new AdminDashboardview();
            dashboard->show();

            //Closing the login window
            this->close();
        }else{
            // Getting negative result
            QMessageBox::warning(this, "Login Failed", "Wrong Email or password");
        }

        reply->deleteLater();
    });
}
