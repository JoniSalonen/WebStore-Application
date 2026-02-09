#include "newproduct.h"
#include "ui_newproduct.h"
#include "admindashboardview.h"
#include "envcreator.h"
#include <QtNetwork/QNetworkRequest>
#include <QtNetwork/QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QFile>
#include <QDebug>
#include <QLineEdit>
#include <QMessageBox>
#include <QComboBox>
#include <QLabel>
#include <QMessageBox>

static QString URL;

NewProduct::NewProduct(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::NewProduct)
{
    ui->setupUi(this);
    setWindowTitle("Add new product");
    envCreator env;
    URL = env.openEnv();

    ui->goBack->setText("Admin dashboard");
    connect(ui->goBack, &QPushButton::clicked,this, &NewProduct::returnBackToAdminView);
}

NewProduct::~NewProduct()
{
    delete ui;
}



// return back to admin dashboard window
void NewProduct::returnBackToAdminView(){
    AdminDashboardview *adminView = new AdminDashboardview();
    adminView->show();
    this->close();
}

