#ifndef NEWPRODUCT_H
#define NEWPRODUCT_H

#include <QMainWindow>
#include <QWidget>
#include <QtNetwork/QNetworkAccessManager>
#include <QComboBox>
#include <QString>
#include <QStringList>

QT_BEGIN_NAMESPACE
namespace Ui {
class NewProduct;
}
QT_END_NAMESPACE

class NewProduct : public QMainWindow
{
    Q_OBJECT

public:
    explicit NewProduct(QWidget *parent = nullptr);
    ~NewProduct();

private:
    Ui::NewProduct *ui;
    QNetworkAccessManager *manager;
    QComboBox *catBox;
    QComboBox *subCatBox;
    QStringList selectedMediaFiles;
    QString currentProductId;

private slots:
    void returnBackToAdminView();
    void productSelection();
    void createProduct();
    void updateProduct();
    void showBoxes();
    void selectMediaFiles();
    void uploadMedia(const QString &productId);
    void deleteSelectedMedia();

    bool validateForm();
    QString categorySelection();
    QString subcategorySelection();
    QString brandSelection();
};

#endif // NEWPRODUCT_H
