const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createClient } = require('@supabase/supabase-js')

const folderRouter = Router();
const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_APIKEY);

async function getFolderWithSubfolders(folderId) {
    const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: {
            files: true,
            subfolders: true,
        },
    });

    if (!folder) {
        throw new Error(`Folder with ID ${folderId} not found`);
    }

    if (folder.subfolders && folder.subfolders.length > 0) {
        const subfolderPromises = folder.subfolders.map(subfolder => getFolderWithSubfolders(subfolder.id));
        const subfolders = await Promise.all(subfolderPromises);
        folder.subfolders = subfolders; 
    }

    return folder;
}


function getAllFilesInFolder(folder) {
    let allFiles = [];

    if (folder.files) {
        allFiles = allFiles.concat(folder.files.map(file => file.url));
    }

    if (folder.subfolders) {
        folder.subfolders.forEach(subfolder => {
            const subfolderFiles = getAllFilesInFolder(subfolder);
            allFiles = allFiles.concat(subfolderFiles);
        });
    }

    return allFiles;
}

folderRouter.post('/edit/:userid/:folderid', async (req,res) => {
    const folderid = parseInt(req.params.folderid);
    const userid = parseInt(req.params.userid);
    const currid = parseInt(req.user.id);
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this folder.`)
    } else { 
        try {
        await prisma.folder.update({
            where: {
                id: folderid,
            },
            data:{
                name: req.body.editname,
                updatedAt: new Date(),
            },
        });

        res.redirect(req.get('Referer'));
        } catch (error) {
            res.status(500).send("Error editing folder name");
    }
    }
})


folderRouter.get('/delete/:userid/:folderid', async (req,res) => {
    const folderid = parseInt(req.params.folderid);
    const userid = parseInt(req.params.userid);
    const currid = parseInt(req.user.id);
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this folder.`)
    } else { 
        try {
           const folder = await getFolderWithSubfolders(folderid);
           const allFiles = getAllFilesInFolder(folder);

           await supabase.storage.from('bdrive').remove(allFiles);

           await prisma.folder.delete({where:{id:folderid}});

           console.log('Delete successfully folder with id: ',folderid);
            
           res.redirect(req.get('Referer'));

        } catch (error) {
            console.error(error);
            return res.status(500).send("Internal server error - error deleting folder");
        }

    }
})












module.exports = folderRouter;