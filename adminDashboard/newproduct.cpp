#include "newproduct.h"
#include "ui_newproduct.h"
#include "admindashboardview.h"
#include "envcreator.h"
#include <QtNetwork/QNetworkRequest>
#include <QtNetwork/QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFile>
#include <QDebug>
#include <QLineEdit>
#include <QMessageBox>
#include <QComboBox>
#include <QLabel>
#include <QMessageBox>
#include <QList>
#include <QHttpMultiPart>
#include <QHttpPart>

static QString URL;
static envCreator env;

// TODO:
// Add media selection button for product
// Add list where image names are added show them to user
// create DB table for images with product id
// Create way to add the images to database
// idea *Create folder system that creates folders
// based on root/media/productId and upload the image under the models folder
// check if any of the folders exist and open/create
// folder repeat until images are in the correct folder
// if previous is too hard just create one folder for all images

// update product method requires RestApi first


NewProduct::NewProduct(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::NewProduct)
{
    ui->setupUi(this);
    setWindowTitle("Add new product");

    URL = env.openEnv();
    manager = new QNetworkAccessManager(this);
    productSelection();

    ui->goBack->setText("Admin dashboard");
    connect(ui->goBack, &QPushButton::clicked,this, &NewProduct::returnBackToAdminView);
    connect(ui->proSubmit, &QPushButton::clicked,this, &NewProduct::createProduct);

    connect(ui->catBox, &QComboBox::currentIndexChanged,this, &NewProduct::showBoxes);
    connect(ui->subCatBox, &QComboBox::currentIndexChanged,this, &NewProduct::showBoxes);
    connect(ui->brandBox, &QComboBox::currentIndexChanged,this, &NewProduct::showBoxes);


    // button for testing
    connect(ui->RefreshProduct, &QPushButton::clicked,this, &NewProduct::productSelection);

    ui->proName->setPlaceholderText("Product name");
    ui->proPrice->setPlaceholderText("Price");
    ui->proStock->setPlaceholderText("Stock");
    ui->brandBox->setPlaceholderText("Brand");
    ui->proBrand->setPlaceholderText("Brand");
    ui->proBrand->hide();

    ui->catBox->setPlaceholderText("Category");
    ui->proCat->setPlaceholderText("Category");
    ui->proCat->hide();

    ui->subCatBox->setPlaceholderText("Subcategory");
    ui->proSubCat->setPlaceholderText("Subcategory");
    ui->proSubCat->hide();

    ui->proDesc->setPlaceholderText("Description");
    ui->proSubmit->setText("Create new product");

    ui->selectMedia->setText("Select images or videos");
    ui->mediaList->hide();

    //testing component
    ui->RefreshProduct->setText("refresh");

}

NewProduct::~NewProduct()
{
    delete ui;
}

// Get product categories, subcategories and brand information from the database.
// Insert the information to dropdown lists where the user can select from previously made listings
// Adds new product listing on each list being add new
void NewProduct::productSelection(){

    // BD connection and calls
    QUrl url(URL + "products");
    QNetworkRequest request(url);

    QString token = env.getToken();
    request.setRawHeader("Authorization","Bearer" + token.toUtf8());
    QNetworkReply *reply = manager->get(request);

    connect(reply, &QNetworkReply::finished, this, [=](){

        QByteArray raw = reply->readAll();
        qDebug() << raw;
        QJsonDocument doc = QJsonDocument::fromJson(raw);
        QJsonArray arr = doc.array();
        QList<QString> categories("Add new category");
        QList<QString> subCategories("Add new subcategory");
        QList<QString> brands("Add new brand");

        for (const auto &val :arr){
            const QJsonObject data = val.toObject();
            const QString category = data["category"].toString();
            const QString subCategory = data["subCategory"].toString();
            const QString brand = data["brandName"].toString();
            const QString price = data["price"].toString();

            if(!categories.contains(category)){
                categories.append(category);
            }else if(!subCategories.contains(subCategory)){
                subCategories.append(subCategory);
            }else if(!brands.contains(brand)){
                brands.append(brand);
            }else{
                qDebug() << "product category was found was found";
            }
        }
        // clears dropboxes and insert/reinsert data
        ui->catBox->clear();
        ui->subCatBox->clear();
        ui->brandBox->clear();
        ui->catBox->addItems(categories);
        ui->subCatBox->addItems(subCategories);
        ui->brandBox->addItems(brands);
        showBoxes();

        reply->deleteLater();
    });
}

void NewProduct::createProduct(){
    // TODO:
    // check if product is previously added if so give error

    // DB connection
    QUrl url(URL + "products");
    QNetworkRequest request(url);

    QString token = env.getToken();
    request.setHeader(QNetworkRequest::ContentTypeHeader,"application/json");
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());

    QString brandName = brandSelection();
    QString category = categorySelection();
    QString subcategory = subcategorySelection();

    // creates data object that can be post to database to create new product
    QJsonObject body;
    body["name"] = ui->proName->text();
    body["price"] = ui->proPrice->text().toDouble();
    body["stock"] = ui->proStock->text().toInt();
    body["brandName"] = brandName;
    body["category"] = category;
    body["subCategory"] = subcategory;
    body["description"] = ui->proDesc->text();

    qDebug() << body;

    QNetworkReply *reply = manager->post(request, QJsonDocument(body).toJson());

    // Sends new products data to database
    connect(reply, &QNetworkReply::finished, this, [this, reply]{
        auto response = QJsonDocument::fromJson(reply->readAll()).object();
        QByteArray raw = reply->readAll();
        QString prodId = response["id"].toString();
        // get media files and uploads paths to DB and images to servers folder

        QMessageBox::about(this, "Confirmation", "New product was added ");

        reply->deleteLater();
    });

}


// TODO
void NewProduct::updateProduct(){
    //TODO:
    // update previously added products
}

void NewProduct::showBoxes(){
    // QComboBox widget that have the data to determinate the situation
    const int cat = ui->catBox->currentIndex();
    qDebug() << cat;
    const int subCat = ui->subCatBox->currentIndex();
    qDebug() << subCat;
    const int brand = ui->brandBox->currentIndex();
    qDebug() << brand;

    if(cat == 0){
        ui->proCat->show();
    }else{
        ui->proCat->hide();
    }

    if(subCat == 0){
        ui->proSubCat->show();
    }else{
        ui->proSubCat->hide();
    }

    if(brand == 0){
        ui->proBrand->show();
    }else{
        ui->proBrand->hide();
    }
}

QString NewProduct::categorySelection(){
    // Checks if new product is going to be created and selects the correct box
    // where the data is going to be selected
    QString result;
    const int cat = ui->catBox->currentIndex();

    if(cat == 0){
        result = ui->proCat->text();
    }else{
        result = ui->catBox->currentText();
    }
    qDebug() << result;
    return result;
}

QString NewProduct::subcategorySelection(){
    // Checks if new product is going to be created and selects the correct box
    // where the data is going to be selected
    QString result;
    const int subCat = ui->subCatBox->currentIndex();

    if(subCat == 0){
        result = ui->proSubCat->text();
    }else{
        result = ui->subCatBox->currentText();
    }
    qDebug() << result;
    return result;
}

QString NewProduct::brandSelection(){
    // Checks if new product is going to be created and selects the correct box
    // where the data is going to be selected
    QString result;
    const int brand = ui->brandBox->currentIndex();

    if(brand == 0){
        result = ui->proBrand->text();
    }else{
        result = ui->brandBox->currentText();
    }
    qDebug() << result;
    return result;
}

// return back to admin dashboard window
void NewProduct::returnBackToAdminView(){
    AdminDashboardview *adminView = new AdminDashboardview();
    adminView->show();
    this->close();
}

