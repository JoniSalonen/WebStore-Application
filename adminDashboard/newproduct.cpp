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
#include <QFileDialog>
#include <QFileInfo>

// Module-level statics shared across all methods in this file
static QString URL;       // Base URL loaded from url.txt via envCreator
static envCreator env;    // Reads the JWT token and base URL from local files

NewProduct::NewProduct(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::NewProduct)
{
    ui->setupUi(this);
    setWindowTitle("Add new product");

    URL = env.openEnv();
    manager = new QNetworkAccessManager(this); // Handles all HTTP requests for this window

    // Populate category/subcategory/brand dropdowns from existing products on open
    productSelection();

    // --- Button labels ---
    ui->goBack->setText("Admin dashboard");
    ui->proSubmit->setText("Create new product");
    ui->selectMedia->setText("Select images or videos");
    ui->deleteMedia->setText("Delete selected");

    // --- Button signals ---
    connect(ui->goBack,      &QPushButton::clicked, this, &NewProduct::returnBackToAdminView);
    connect(ui->proSubmit,   &QPushButton::clicked, this, &NewProduct::createProduct);
    connect(ui->selectMedia, &QPushButton::clicked, this, &NewProduct::selectMediaFiles);
    connect(ui->deleteMedia, &QPushButton::clicked, this, &NewProduct::deleteSelectedMedia);
    connect(ui->RefreshProduct, &QPushButton::clicked, this, &NewProduct::productSelection);

    // Each dropdown triggers showBoxes so the matching "Add new" text field
    // appears or disappears depending on whether index 0 ("Add new") is selected
    connect(ui->catBox,    &QComboBox::currentIndexChanged, this, &NewProduct::showBoxes);
    connect(ui->subCatBox, &QComboBox::currentIndexChanged, this, &NewProduct::showBoxes);
    connect(ui->brandBox,  &QComboBox::currentIndexChanged, this, &NewProduct::showBoxes);

    // --- Placeholder text for input fields ---
    ui->proName->setPlaceholderText("Product name");
    ui->proPrice->setPlaceholderText("Price");
    ui->proStock->setPlaceholderText("Stock");
    ui->brandBox->setPlaceholderText("Brand");
    ui->proBrand->setPlaceholderText("Brand");
    ui->catBox->setPlaceholderText("Category");
    ui->proCat->setPlaceholderText("Category");
    ui->subCatBox->setPlaceholderText("Subcategory");
    ui->proSubCat->setPlaceholderText("Subcategory");
    ui->proDesc->setPlaceholderText("Description");

    // "Add new" text fields and the media list start hidden;
    // they appear only when needed
    ui->proBrand->hide();
    ui->proCat->hide();
    ui->proSubCat->hide();
    ui->mediaList->hide();
    ui->deleteMedia->hide();

    ui->RefreshProduct->setText("refresh");
}

NewProduct::~NewProduct()
{
    delete ui;
}

// Fetches all existing products from the backend and extracts unique
// categories, subcategories and brand names to populate the three dropdowns.
// Index 0 in every dropdown is always "Add new …" so the user can enter
// a value that does not exist yet.
void NewProduct::productSelection(){
    QUrl url(URL + "products");
    QNetworkRequest request(url);

    // Attach the JWT so the protected endpoint accepts the request
    QString token = env.getToken();
    request.setRawHeader("Authorization","Bearer " + token.toUtf8());
    QNetworkReply *reply = manager->get(request);

    connect(reply, &QNetworkReply::finished, this, [=](){

        QByteArray raw = reply->readAll();
        qDebug() << raw;
        QJsonDocument doc = QJsonDocument::fromJson(raw);
        QJsonArray arr = doc.array();

        // "Add new …" entries are always first so index 0 means "type a new value"
        QList<QString> categories("Add new category");
        QList<QString> subCategories("Add new subcategory");
        QList<QString> brands("Add new brand");

        // Walk every product and collect distinct values — duplicates are skipped
        for (const auto &val : arr){
            const QJsonObject data = val.toObject();
            const QString category    = data["category"].toString();
            const QString subCategory = data["subCategory"].toString();
            const QString brand       = data["brandName"].toString();

            if(!categories.contains(category))       categories.append(category);
            if(!subCategories.contains(subCategory)) subCategories.append(subCategory);
            if(!brands.contains(brand))              brands.append(brand);
        }

        // Clear and refill the dropdowns so stale data does not linger
        ui->catBox->clear();
        ui->subCatBox->clear();
        ui->brandBox->clear();
        ui->catBox->addItems(categories);
        ui->subCatBox->addItems(subCategories);
        ui->brandBox->addItems(brands);

        // Re-evaluate which "Add new" text fields should be visible
        showBoxes();

        reply->deleteLater();
    });
}

// Validates every required field before a network request is made.
// Collects all problems into a list and shows them in one dialog so the
// user can fix everything at once instead of one error at a time.
// Returns true only when every check passes.
bool NewProduct::validateForm(){
    QStringList errors;

    if(ui->proName->text().trimmed().isEmpty())
        errors << "• Product name is required";

    // toDouble() sets the bool flag to false if the string is not a valid number
    bool priceOk = false;
    double price = ui->proPrice->text().toDouble(&priceOk);
    if(!priceOk || price <= 0)
        errors << "• Price must be a positive number";

    bool stockOk = false;
    int stock = ui->proStock->text().toInt(&stockOk);
    if(!stockOk || stock < 0)
        errors << "• Stock must be a non-negative integer";

    // categorySelection() / subcategorySelection() / brandSelection() already
    // decide whether to read the dropdown or the free-text field
    if(categorySelection().trimmed().isEmpty())
        errors << "• Category is required";

    if(subcategorySelection().trimmed().isEmpty())
        errors << "• Subcategory is required";

    if(brandSelection().trimmed().isEmpty())
        errors << "• Brand is required";

    if(ui->proDesc->text().trimmed().isEmpty())
        errors << "• Description is required";

    // At least one file must be staged before the product can be submitted
    if(selectedMediaFiles.isEmpty())
        errors << "• At least one image or video is required";

    if(!errors.isEmpty()){
        QMessageBox::warning(this, "Missing required fields",
                             "Please fix the following before submitting:\n\n" + errors.join("\n"));
        return false;
    }
    return true;
}

// Sends a POST request to create a new product in the database.
// On success, immediately uploads any staged media files and stores
// the new product's ID so the delete endpoint can reference it later.
void NewProduct::createProduct(){
    // Block the request if any required field is missing or invalid
    if(!validateForm())
        return;

    QUrl url(URL + "products");
    QNetworkRequest request(url);

    QString token = env.getToken();
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());

    // Resolve category/subcategory/brand — either from the dropdown or the free-text field
    QString brandName  = brandSelection();
    QString category   = categorySelection();
    QString subcategory = subcategorySelection();

    // Build the JSON body that maps to the CreateProductDto on the backend
    QJsonObject body;
    body["name"]        = ui->proName->text();
    body["price"]       = ui->proPrice->text().toDouble();
    body["stock"]       = ui->proStock->text().toInt();
    body["brandName"]   = brandName;
    body["category"]    = category;
    body["subCategory"] = subcategory;
    body["description"] = ui->proDesc->text();

    qDebug() << body;

    QNetworkReply *reply = manager->post(request, QJsonDocument(body).toJson());

    connect(reply, &QNetworkReply::finished, this, [this, reply]{
        QByteArray raw = reply->readAll();
        auto response = QJsonDocument::fromJson(raw).object();
        QString prodId = response["id"].toString(); // UUID returned by the backend

        if (!prodId.isEmpty()) {
            // Store the ID so deleteSelectedMedia() can build the correct URL later
            currentProductId = prodId;
            if (!selectedMediaFiles.isEmpty())
                uploadMedia(prodId);
        }

        QMessageBox::about(this, "Confirmation", "New product was added");
        reply->deleteLater();
    });
}

// Opens a native file-picker dialog filtered to supported image and video formats.
// Newly selected paths are appended to selectedMediaFiles (duplicates removed)
// and the list widget is refreshed to show only filenames, not full paths.
void NewProduct::selectMediaFiles(){
    QStringList files = QFileDialog::getOpenFileNames(
        this,
        "Select images or videos",
        QString(),
        "Media files (*.jpg *.jpeg *.png *.gif *.webp *.mp4 *.mov *.avi *.mkv)"
    );

    if(files.isEmpty())
        return;

    selectedMediaFiles.append(files);
    selectedMediaFiles.removeDuplicates(); // Prevents the same file being staged twice

    // Refresh the visible list — items at this stage have no server ID yet
    ui->mediaList->clear();
    for(const QString &path : selectedMediaFiles){
        ui->mediaList->addItem(QFileInfo(path).fileName());
    }
    ui->mediaList->show();
    ui->deleteMedia->show();
}

// Packages all staged files into a single multipart/form-data request and
// POSTs them to POST /products/:id/media.
// The server saves each file to disk under media/<productId>/ and creates a
// Media row in the database. On success the list widget is repopulated with
// items that carry the server-assigned media ID in their UserRole data,
// which is needed later if the user wants to delete a file.
void NewProduct::uploadMedia(const QString &productId){
    if(selectedMediaFiles.isEmpty())
        return;

    // One QHttpMultiPart will carry all files in a single HTTP request
    QHttpMultiPart *multiPart = new QHttpMultiPart(QHttpMultiPart::FormDataType);
    int added = 0;

    for(const QString &filePath : selectedMediaFiles){
        QFile *file = new QFile(filePath);
        if(!file->open(QIODevice::ReadOnly)){
            delete file;
            continue; // Skip unreadable files silently
        }

        QFileInfo info(filePath);
        QString suffix = info.suffix().toLower();

        // Map the file extension to the correct MIME type for the Content-Type header
        QString mimeType;
        if(suffix == "jpg" || suffix == "jpeg")   mimeType = "image/jpeg";
        else if(suffix == "png")                  mimeType = "image/png";
        else if(suffix == "gif")                  mimeType = "image/gif";
        else if(suffix == "webp")                 mimeType = "image/webp";
        else if(suffix == "mp4")                  mimeType = "video/mp4";
        else if(suffix == "mov")                  mimeType = "video/quicktime";
        else if(suffix == "avi")                  mimeType = "video/x-msvideo";
        else if(suffix == "mkv")                  mimeType = "video/x-matroska";
        else                                      mimeType = "application/octet-stream";

        QHttpPart filePart;
        filePart.setHeader(QNetworkRequest::ContentTypeHeader, mimeType);
        // "files" must match the field name expected by FilesInterceptor on the backend
        filePart.setHeader(QNetworkRequest::ContentDispositionHeader,
                           QString("form-data; name=\"files\"; filename=\"%1\"").arg(info.fileName()));
        filePart.setBodyDevice(file);
        file->setParent(multiPart); // multiPart now owns the file and will close it
        multiPart->append(filePart);
        added++;
    }

    if(added == 0){
        delete multiPart;
        return;
    }

    QUrl url(URL + "products/" + productId + "/media");
    QNetworkRequest request(url);
    request.setRawHeader("Authorization", "Bearer " + env.getToken().toUtf8());

    QNetworkReply *reply = manager->post(request, multiPart);
    multiPart->setParent(reply); // reply owns multiPart; both are cleaned up in deleteLater()

    connect(reply, &QNetworkReply::finished, this, [this, reply](){
        int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        QByteArray raw = reply->readAll();
        qDebug() << "Media upload:" << status << raw;

        if(status >= 200 && status < 300){
            // Repopulate the list using server response so each item carries
            // its database ID — required for the delete endpoint
            QJsonArray mediaArray = QJsonDocument::fromJson(raw).array();
            ui->mediaList->clear();
            for(const auto &val : mediaArray){
                const QJsonObject obj = val.toObject();
                QListWidgetItem *item = new QListWidgetItem(obj["filename"].toString());
                // Store the media UUID in UserRole so deleteSelectedMedia() can retrieve it
                item->setData(Qt::UserRole, obj["id"].toString());
                ui->mediaList->addItem(item);
            }
            ui->deleteMedia->show();
        }

        reply->deleteLater();
    });
}

// Deletes the currently selected item in the media list.
// Two cases are handled:
//   1. File not yet uploaded (no server ID) — removed only from the local
//      selectedMediaFiles list, no network request needed.
//   2. File already uploaded (has a server ID stored in UserRole) — sends
//      DELETE /products/:productId/media/:mediaId to remove the database
//      record and the file from disk on the server.
void NewProduct::deleteSelectedMedia(){
    QListWidgetItem *item = ui->mediaList->currentItem();
    if(!item) return;

    QString mediaId = item->data(Qt::UserRole).toString();

    // No server ID means the file is only staged locally — just dequeue it
    if(mediaId.isEmpty()){
        QString filename = item->text();
        // Remove the matching full path from the staged list by filename
        selectedMediaFiles.removeIf([&](const QString &path){
            return QFileInfo(path).fileName() == filename;
        });
        delete ui->mediaList->takeItem(ui->mediaList->row(item));
        if(ui->mediaList->count() == 0)
            ui->mediaList->hide();
        return;
    }

    // File is on the server — ask the backend to delete both the DB row and the file
    QUrl url(URL + "products/" + currentProductId + "/media/" + mediaId);
    QNetworkRequest request(url);
    request.setRawHeader("Authorization", "Bearer " + env.getToken().toUtf8());

    QNetworkReply *reply = manager->deleteResource(request);

    connect(reply, &QNetworkReply::finished, this, [this, reply, item](){
        int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        if(status >= 200 && status < 300){
            delete ui->mediaList->takeItem(ui->mediaList->row(item));
            // Hide the list and delete button when all media have been removed
            if(ui->mediaList->count() == 0){
                ui->mediaList->hide();
                ui->deleteMedia->hide();
            }
        } else {
            QMessageBox::warning(this, "Error", "Failed to delete media");
        }
        reply->deleteLater();
    });
}

void NewProduct::updateProduct(){
    // TODO: implement editing of existing products once the REST endpoint exists
}

// Shows or hides the free-text "Add new" fields depending on which dropdown
// option is selected. Index 0 in each dropdown means "Add new …", so when
// it is selected the matching text field becomes visible for the user to type in.
void NewProduct::showBoxes(){
    const int cat    = ui->catBox->currentIndex();
    const int subCat = ui->subCatBox->currentIndex();
    const int brand  = ui->brandBox->currentIndex();

    ui->proCat->setVisible(cat == 0);
    ui->proSubCat->setVisible(subCat == 0);
    ui->proBrand->setVisible(brand == 0);
}

// Returns the category to use for the new product.
// If the dropdown is on index 0 ("Add new category"), the free-text field
// value is returned. Otherwise the selected dropdown text is returned.
QString NewProduct::categorySelection(){
    const int cat = ui->catBox->currentIndex();
    QString result = (cat == 0) ? ui->proCat->text() : ui->catBox->currentText();
    qDebug() << result;
    return result;
}

// Same logic as categorySelection() but for subcategory.
QString NewProduct::subcategorySelection(){
    const int subCat = ui->subCatBox->currentIndex();
    QString result = (subCat == 0) ? ui->proSubCat->text() : ui->subCatBox->currentText();
    qDebug() << result;
    return result;
}

// Same logic as categorySelection() but for brand name.
QString NewProduct::brandSelection(){
    const int brand = ui->brandBox->currentIndex();
    QString result = (brand == 0) ? ui->proBrand->text() : ui->brandBox->currentText();
    qDebug() << result;
    return result;
}

// Navigates back to the admin dashboard by creating a new dashboard window,
// showing it, and closing this window.
void NewProduct::returnBackToAdminView(){
    AdminDashboardview *adminView = new AdminDashboardview();
    adminView->show();
    this->close();
}
