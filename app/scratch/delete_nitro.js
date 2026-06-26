import fs from 'fs';

const filePath = 'c:/Users/Garrido/registro-servicos/app/components/pages/NitroAdminPage.jsx';
if (fs.existsSync(filePath)) {
  fs.unlinkSync(filePath);
  console.log("Deleted NitroAdminPage.jsx successfully!");
} else {
  console.log("File already deleted or not found.");
}
