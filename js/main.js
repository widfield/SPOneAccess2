var _CTX = $().SPServices.SPGetCurrentSite(),
    _SPGrind = new SPGrind(),
    tempGroups;

var subSites;
$('#getSubSites').click(function(){
     $('#getSubSites').hide();
     $('#loadingSites').show();
    if (!!window.Worker){
        worker = new Worker('js/getSubSitesWorker.js');
        worker.onmessage = function(e){
            subSites = e.data[0];
            for (var i = 0 ; i < subSites.length; i++){
                 $('#emptyFoldersSites').append($('<option>',{
                    value: subSites[i].url,
                    text: subSites[i].name + ' (' + subSites[i].url.split('/')[subSites[i].url.split('/').length-1]+')' 
                    }));
            }
            $('#loadingSites').hide();
            $('#emptyFoldersSites').css({'display':'block'})
        }
        worker.postMessage([_CTX,'structure', false]);
        
    }
     
});


var siteTemplate,
    fabTemplate,
    spData,
    currentUser,
    thisUserEmail = $().SPServices.SPGetCurrentUser({
        fieldName: "Email",
        debug: false
    });


var accessFab = {
    "color": "hpe-turquoise",
    "copy": true,
    "busy": false
};

$(function() {
    spData = _SPGrind.getSPSites(_CTX, false);
    //currentUser = allocateUserDetails(thisUserEmail);
    currentUser = allocateUserDetails(thisUserEmail);
    siteTemplate = new Ractive({
        el: "#sites-container",
        template: "#site-template",
        data: {
            site: spData
        }
    });

    fabTemplate = new Ractive({
        el: "#action-btn-contaier",
        template: "#fab-template",
        data: accessFab
    });

    showCurrentUserGroups();

    fabTemplate.on({
        copy: function(event) {
            copyUserPermissions();
            console.log(event.node);
            fabTemplate.animate("copy", false);
            // event.context.copy = false;
            fabTemplate.update();
        },
        paste: function(event) {
            pasteUserPermissions();
        },
        clearGroups: function(event) {
            tempGroups = "";
            event.context.copy = true;
            fabTemplate.update();
        }
    });

    siteTemplate.on({
        addUser: function(event) {
            event.context.addUser(currentUser);
            notifyOnUserChanged(event.context, currentUser, siteTemplate, " added to group.", 5000);

        },
        removeUser: function(event) {
            event.context.removeUser(currentUser);
            notifyOnUserChanged(event.context, currentUser, siteTemplate, " removed from group.", 5000);
        },
        getGroups: function(event) {
            event.context.setGroups(false);
            currentUser = allocateUserDetails(thisUserEmail);
            compareUser(event.context, currentUser, siteTemplate);
        }
    });
});

function notifyOnUserChanged(context, user, template, message, timeout) {
    user = allocateUserDetails(thisUserEmail);
    if (user.getName() !== "") {
        compareUser(context, user, template);
        Materialize.toast(user.getName() + message, timeout);
    } else {
        Materialize.toast("Action is not valid", timeout);
    }
    showCurrentUserGroups();
}

function compareUser(obj, user, template) {

    var groups = [];

    if (user !== undefined) {
        if (obj instanceof Site) {
            groups = obj.groups;
        } else {
            groups.push(obj);
        }
        for (var j = 0; j < groups.length; j++) {
            groups[j].addable = !hasGroup(groups[j].name);
        }
    }

    template.update();
    

    function hasGroup(group) {
        return user.groups.some(function(v) {
            return v.name == group;
        });
    }
}

function copyUserPermissions() {
    console.log("Copying user permissions");
    allocateUserDetails(thisUserEmail);
    tempGroups = currentUser.getGroups();
}

function pasteUserPermissions() {
    if (!!window.Worker) {
        var pastePermissions = new Worker("js/pastePermissionsWorker.js");
        pastePermissions.onmessage = function(e) {
            if (e.data === "working") {
                Materialize.toast("Began pasting user permissions.", 5000);
                fabTemplate.set("busy", true);
            } else if (e.data === "done") {
                Materialize.toast("Done pasting user permissions.", 5000);
                fabTemplate.set("busy", false);
                showCurrentUserGroups();
            } else {
                Materialize.toast("Sorry, can't paste user permissions.", 5000);
            }
        };
        pastePermissions.postMessage([currentUser, tempGroups]);
    }
    siteTemplate.update();
}

function allocateUserDetails(userData) {
    var user = new User();
    if (!!userData.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)){
        user.setEmail(userData);
        user.setInfoByEmail(_CTX);
    }else{
        user.setLogin(userData);
        user.setInfoByLogin(_CTX);
        thisUserEmail = user.getEmail();
    }
    user.setGroups();
    return user;
};

$('#user_form').submit(function(e) {
    e.preventDefault();
    thisUserEmail = $('#user_email').val();
    currentUser = allocateUserDetails(thisUserEmail);
    //thisUserEmail = currentUser.email;
    if (currentUser.getName() !== '' && currentUser.getName() !== undefined) {
        $("#user_email").val(currentUser.getName());
        for (var i = 0; i < spData.length; i++) {
            if (spData[i].groups) {
                console.log("Updating view on user change!");
                compareUser(spData[i], currentUser, siteTemplate);
            }
        }
        showCurrentUserGroups();
    } else {
        $('#user_email').val('Invalid Email/Login').addClass('invalid');
        $('#current-groups-container').children().remove();
    }
});


//for the matrix
function saveExcelFile(data, fileName) {
    //set the file name
    var filename = fileName + '.xlsx';

    //put the file stream together
    var s2ab = function(s) {
        var buf = new ArrayBuffer(s.length);
        var view = new Uint8Array(buf);
        for (var i = 0; i != s.length; ++i) {
            view[i] = s.charCodeAt(i) & 0xFF;
        }
        return buf;
    };
    //invoke the saveAs method from FileSaver.js
    saveAs(new Blob([s2ab(data)], {
        type: 'application/octet-stream'
    }), filename);
};

function convertNumber(n) {
    var ordA = 'A'.charCodeAt(0);
    var ordZ = 'Z'.charCodeAt(0);
    var len = ordZ - ordA + 1;
  
    var s = "";
    while(n >= 0) {
        s = String.fromCharCode(n % len + ordA) + s;
        n = Math.floor(n / len) - 1;
    }
    return s;
};
function saveWorkbook(workbook, name) {
    workbook.save({ type: 'blob' }, function (data) {
        saveAs(data, name);
    }, function (error) {
        alert('Error exporting: : ' + error);
    });
}

function generateMatrixExcel(sites, groups, lists){
    var cell ;
    var cellNumber = '';            
    var format;
    var workbook = new $.ig.excel.Workbook($.ig.excel.WorkbookFormat.excel2007);
    var matrix = workbook.worksheets().add('Permission Matrix');
    var users = workbook.worksheets().add('Users');
    var resLists = workbook.worksheets().add('Restricted Lists');

    for (var i = 0; i < sites.length; i++){ //vsichki koloni sus sitovete
        cellNumber = convertNumber(i + 1);
        cellNumber += 1;
        cell = matrix.getCell(cellNumber);
        cell.value(sites[i].name);
        format = matrix.getCell(cellNumber).cellFormat();
        format.fill($.ig.excel.CellFill.createLinearGradientFill(45, '#01a982', '#01a982'));

    }
    for (var i = 0; i < groups.length; i++){
        cellNumber = 'A' + (i + 2);
        cell = matrix.getCell(cellNumber);
        cell.value(groups[i].name);
        for (var j = 0; j < sites.length; j++){
            for(var k = 0; k < groups[i].url.length; k++){
                if (sites[j].url == groups[i].url[k]){
                    cellNumber = '';
                    cellNumber = convertNumber(j + 1);
                    cellNumber += (i + 2);
                    var groupPermissions = '';
                    for (var p = 0; p < groups[i].permissions[k].length; p++){
                        var comma = ', '
                        if (p == groups[i].permissions[k].length - 1){
                            comma = ''
                        }
                        groupPermissions += groups[i].permissions[k][p] + comma;
                    }
                    cell = matrix.getCell(cellNumber);
                    cell.value(groupPermissions);
                    
                    if(groupPermissions.indexOf('Read') > -1){
                        format = matrix.getCell(cellNumber).cellFormat();
                        format.fill($.ig.excel.CellFill.createLinearGradientFill(45, '#FF8D6D', '#FF8D6D'));
                    }
                    if(groupPermissions.indexOf('Limited Access') > -1){
                        format = matrix.getCell(cellNumber).cellFormat();
                        format.fill($.ig.excel.CellFill.createLinearGradientFill(45, '#C6C9CA', '#C6C9CA'));
                    }
                    if(groupPermissions.indexOf('Full Control') > -1){
                        format = matrix.getCell(cellNumber).cellFormat();
                        format.fill($.ig.excel.CellFill.createLinearGradientFill(45, '#C2AEC8', '#C2AEC8'));
                    }
                    if(groupPermissions.indexOf('Contribute') > -1){
                        format = matrix.getCell(cellNumber).cellFormat();
                        format.fill($.ig.excel.CellFill.createLinearGradientFill(45, '#7DE6E0', '#7DE6E0'));
                    }
                }
            }
        }
      cellNumber = convertNumber(i); 
        cell = users.getCell(cellNumber+1);
        cell.value(groups[i].name);
        for(var u = 0; u < groups[i].users.length; u++){
            var userInfo = groups[i].users[u].email || groups[i].users[u].login;
            cell = users.getCell(cellNumber+(u+2));
            cell.value(userInfo);
            
        } 
    };
    cell = resLists.getCell('A1');
    cell.value('List Name');
    cell = resLists.getCell('B1');
    cell.value('URL');
    for(var i = 0; i < lists.length; i++){
        //var name = lists[i].name;
        //var url = lists[i].url;
        cell = resLists.getCell('A'+(i+2));
        cell.value(lists[i].name);
        cell = resLists.getCell('B'+(i+2));
        cell.value(lists[i].url);
    };
    var name = _CTX.split('/');
    name = name[name.length - 1] + ' - Permission Matrix' + ".xlsx";
    saveWorkbook(workbook,name)

};


var sites = [];
var matrixSites = [];
var groups = []; 
var restrictedLists = [];
var usersInGroup = [];
var worker;
var allUsers = [];
var pdls = [];
var emptyFolders = [];
var libraryName = location.pathname.split('/');
libraryName = libraryName[libraryName.length - 2];


$('#matrix-section').on('click', function(e){
    if (e.target.id == 'generate-matrix' || $(e.target).parent()[0].id == 'generate-matrix'){
        $('#generate-matrix').hide()
        $('#generating-matrix').show();
        if (!!window.Worker){
            worker = new Worker('js/generateMatrixWorker.js');
            worker.onmessage = function(e){
                matrixSites = e.data[0];
                groups = e.data[1];
                restrictedLists = e.data[2];
                generateMatrixExcel(matrixSites, groups, restrictedLists);
                $('#generating-matrix').hide();
                $('#ready-matrix').show();
            }
            worker.postMessage([_CTX, 'matrix']);
        }
    } else if(e.target.id == 'cancel-matrix'){
        $('#generating-matrix').hide();
        $('#generate-matrix').show();
        worker.terminate();
        worker = undefined;
    } else if(e.target.id == 'ready-matrix' || $(e.target).parent()[0].id == 'ready-matrix'){
        $('#ready-matrix').hide();
        $('#generate-matrix').show();
    }
});


//structure section
$('#structure-section').on('click', function(e){
    if (e.target.id == 'generate-structure' || $(e.target).parent()[0].id == 'generate-structure'){
        $('#generate-structure').hide()
        $('#generating-structure').show();
        if (!!window.Worker){
            worker = new Worker('js/structureCreatorWorker.js');
            worker.onmessage = function(e){
                info = e.data[0];
                window.localStorage.setItem('Info', JSON.stringify(info));
                window.open(_CTX + "/" + libraryName + "/client/visio.aspx", '_blank');
                window.focus();
                $('#generating-structure').hide();
                $('#generate-structure').show();
            }
            worker.postMessage([_CTX,'structure']);
        }
    } else if(e.target.id == 'cancel-structure'){
        $('#generating-structure').hide();
        $('#generate-structure').show();
        worker.terminate();
        worker = undefined;
    }/* else if(e.target.id == 'ready-struct'){
        $('#ready-matrix').hide();
        $('#generate-matrix').show();
    }*/
});

//empty-folders
 
$('#empty-folders-section').on('click',function(e){
   
    

    
    if(e.target.id == 'generate-empty-folders' || $(e.target).parent()[0].id == 'generate-empty-folders'){
        $('#generate-empty-folders').hide();
        $('#generating-empty-folders').show();
        if (!!window.Worker){
            worker = new Worker('js/getEmptyFoldersWorker.js');
            worker.onmessage = function(e){
                emptyFolders = e.data[0];
                generateEmptyFoldersExcel(emptyFolders);
                $('#generating-empty-folders').hide();
                $('#ready-empty-folders').show();
            }
            worker.postMessage([_CTX,'structure',$('#emptyFoldersSites').find(":selected").val()]);
        } 
    }else if(e.target.id == 'cancel-empty-folders'){
        $('#generating-empty-folders').hide();
        $('#generate-empty-folders').show();
        worker.terminate();
        worker = undefined;
    }else if(e.target.id == 'ready-empty-folders' || $(e.target).parent()[0].id == 'ready-empty-folders'){
        $('#ready-empty-folders').hide();
        $('#generate-empty-folders').show();
    }
});

//get all users
$('#all-users-section').on('click', function(e){
    if (e.target.id == 'get-all-users' || $(e.target).parent()[0].id == 'get-all-users'){
        $('#get-all-users').hide();
        getAllUsers();
        $('#ready-users').show();
        generateAllUsersExcel();
       
    } else if(e.target.id == 'ready-users' || $(e.target).parent()[0].id == 'ready-users'){
        $('#ready-users').hide();
        $('#get-all-users').show();
    }
});


//MASS DELETE
//var epDel = new ExcelPlus();
var epDel =  new ExcelPlus();
    userEmails = [],
    validUsers = [],
    invalidUsers = [],
    validUsersCounter = 0,
    invalidUsersCounter = 0;

//for the copy clipboard
// $(document).ready(function() {
//     var clip = new ZeroClipboard($("#d_clip_button"));
// });
    // $('#instr-nav').on('click', function(e){
    //     $('#instr-container').children().hide();
    //     $($('.' + e.target.className)).show();
    // });

function resetAll() {
    //epDel.reset();
    userEmails = [];
    validUsers = [];
    userEmails = [];
};

    // we call openLocal() and when the file is loaded then we want to display its content
    // openLocal() will use the FileAPI if exists, otherwise it will use a Flash object
 epDel.openLocal({
    "flashPath": "2.2/swfobject/",
    "labelButton": "Open an Excel file"
}, function() {
    resetAll();
    var arr = epDel.selectSheet('MassDelete').readAll();
    console.log(arr);

    // iterate and push emails to userEmails array
    for (var i = 0; i < arr.length; i++) {
        for (var j = 0; j < arr[i].length; j++) {
            userEmails.push(arr[i][j]);
        }
    }
    if (!!window.Worker){
        worker = new Worker('js/identifyUsersWorker.js');
        worker.onmessage = function(e){
            validUsers = e.data[0];
            invalidUsers = e.data[1];
            console.log('worker ready');
            iterateUsers();
             $('#identifying-users').hide();
             $('#delete-button').show();
        }
        worker.postMessage([userEmails, _CTX]);
        $('#identifying-users').show()
    }

});

function iterateUsers() {
    //var max = Math.max(validUsers.length, invalidUsers.length)
    for (var x = 0; x < validUsers.length; x++) { 
        $("#valid-list").append(
            "<li class='row'><span class='col s6'>"+ validUsers[x].email + "</span><span class='col s6 del-valid' id='" + validUsersCounter +"' style='cursor:pointer;position:relative;top:1px'>remove from list</span></li>");
        validUsersCounter++;
    }  
    for(var x = 0; x < invalidUsers.length; x++){
            $("#invalid-list").append(
                "<li class='row'><span class='col s6'>"+ invalidUsers[x] +"</span></li>"); //<span class='col s6 del-invalid' id='" + invalidUsersCounter +"'  style='cursor:pointer;position:relative;top:1px'>delete</span></li>");
            invalidUsersCounter++;
    }
    

    $($('#valid').children()[0]).html($($('#valid').children()[0]).html() + ' - ' + validUsers.length);
    $($('#invalid').children()[0]).html($($('#invalid').children()[0]).html() + ' - ' + invalidUsers.length);
    //updating the view when user is removed from the valid user list
    $('.del-valid').click(function(e) {
        //e.preventDefault();
        $(this).closest('li').remove();
        validUsers[parseInt($(this).attr('id'))] = undefined;
        validUsersCounter--;
        updateValidUsersNumber();
    });
};

function updateValidUsersNumber(){
    $($('#valid').children()[0]).html('Valid Users - ' + validUsersCounter);
}

function deleteUser(user){
    if (validUsers[user] != undefined){
        $().SPServices({
            operation:"RemoveUserFromSite",
            userLoginName: validUsers[user].login,
            async:true,
            completefunc: function(xData, Status){
                if (Status == 'success'){
                    console.log('validUsers['+ user +'] was deleted');
                        validUsersCounter--;
                        updateValidUsersNumber();
                        $('#'+ user).closest('li').remove();                       
                } else {
                    $('#'+ user).prev().css('background','rgb(255, 141, 109)');
                    console.log('validUsers['+ user +'] was not found on the server!!!');
                }
            }
        });
    }else{
        console.log('validUsers['+ user +'] is ' + validUsers[user]);
    }
};

function showCurrentUserGroups(){
    currentUser.setGroups();
    $('#current-groups-container').html(''); 
    for (var i = 0; i < currentUser.groups.length; i++){
        $('#current-groups-container').append('<li style="border: 1px solid rgb(198, 201, 202)">' + currentUser.groups[i].name + '</li>');
    }
};

$('#delete-users').click(function(){
    for(var i = 0 ; i < validUsers.length; i++){
        deleteUser(i);
    }
    $('#delete-button').hide();
});

$(document).ready(function(){
     $('.modal-trigger').leanModal();
     

 });

$('#instr-nav').on('click', function(e){
    $('#instr-container').children().hide();
    $($('.' + e.target.className)).show();
});
function getAllUsers(){
    allUsers = [];
    pdls = [];
    // $().SPServices({       returns all users, including users in pdls
    //     async: false,
    //     operation: 'GetUserCollectionFromSite',
    //     completefunc: function(xData, Status){
    //         $(xData.responseXML).find('User').each(function(){
    //             var user = new User();
    //             user.setEmail($(this).attr('Email'));
    //             user.setName($(this).attr('Name'));
    //             user.setLogin($(this).attr('LoginName')); 
    //             allUsers.push(user)});
    //      }
    // });

    $().SPServices({
        async: false,
        operation: 'GetListItems',
        listName: 'User Information List',
        completefunc: function(xData, Status){
            $(xData.responseXML).find('row').each(function(){
                var user = new User();
                user.setEmail($(this).attr('ows_EMail'));
                user.setName($(this).attr('ows_Title'));
                user.setLogin($(this).attr('ows_Name'));
                if(user.getName().indexOf(',') > -1){
                    allUsers.push(user)
                }else{
                    pdls.push(user)
                }
            });
         }
    });
};

function generateAllUsersExcel(){
    var epUsers = new ExcelPlus();
    epUsers.createFile('Users');
    epUsers.createSheet('PDLs');
    if (_CTX.indexOf('external') > -1 ){
        epUsers.createSheet('External');
    }
    for (var i = 0; i < allUsers.length; i++){
        epUsers.write({
            'sheet' : 'Users',
            'cell' :  'A' + (i + 1),
            'content' : allUsers[i].getEmail() || '--- NO EMAIL ---'
        });
        epUsers.write({
            'sheet' : 'Users',
            'cell' :  'B' + (i + 1),
            'content' : allUsers[i].getName()
        }); 
        epUsers.write({
            'sheet' : 'Users',
            'cell' :  'C' + (i + 1),
            'content' : allUsers[i].getLogin()
        });  
    }   

    var rowPDLs = 0;
    var rowExtrenal = 0;
    var row;
    for(var i = 0; i < pdls.length; i++){
        if (pdls[i].login.indexOf('EXTRANET') > -1){
            epUsers.selectSheet('External');
            rowExtrenal++;
            row = rowExtrenal;
        }else{
            epUsers.selectSheet('PDLs');
            rowPDLs++;
            row = rowPDLs;
        }
        epUsers.write({
           // 'sheet' : 'PDLs',
            'cell' :  'A' + row,
            'content' : pdls[i].getEmail() || '--- NO EMAIL ---'
        });
         epUsers.write({
           // 'sheet' : 'PDLs',
            'cell' :  'B' + row,
            'content' : pdls[i].getName()
        }); 
        epUsers.write({
            //'sheet' : 'PDLs',
            'cell' :  'C' + row,
            'content' : pdls[i].getLogin()
        });  
    }
    var name = _CTX.split('/');
    name = name[name.length - 1] + ' - All users';
    epUsers.saveAs(name);
   
};

$('#central-nav').on('click', function(e){
    if (e.target.id){
        $('#main-section').children().hide();
        $($('.' + e.target.id)[0]).show();
    }
});


// get empty folders
function generateEmptyFoldersExcel(sites){
    var ep = new ExcelPlus();
    var cellsLetters = ['A','B','C','D','E','F','G','H','I'];
  
    ep.createFile("Empty Folders");
    ep.write({'cell':'A1','content': 'Folder Name'});
    ep.write({'cell':'B1','content': 'URL'});
    ep.write({'cell':'C1','content': 'ID'});
    ep.write({'cell':'D1','content': 'Date Created'});
    ep.write({'cell':'E1','content': 'Last Modified'});
    ep.write({'cell':'F1','content': 'Editor'});
    ep.write({'cell':'G1','content': 'Name'});
    ep.write({'cell':'H1','content': 'Subsite'});
    ep.write({'cell':'I1','content': 'Library'});
    var row = 2;
    for(var i = 0; i < sites.length; i++){
        for(var j = 0; j < sites[i].lists.length; j++){
            if(sites[i].lists[j].hasOwnProperty('emptyFolders')){
                
                for(var f = 0; f < sites[i].lists[j].emptyFolders.length; f++){
                    var count = 0;
                    for(var key in sites[i].lists[j].emptyFolders[f]) {
                        var value = sites[i].lists[j].emptyFolders[f][key].toString();
                        var cellName = (cellsLetters[count] + row).toString();
                        ep.write({'cell': cellName, 'content': value});
                        count++;
                    };
                     row++;
                }
            }
        }
    }
    var name = _CTX.split('/');
    name = name[name.length - 1] + ' - Empty Folders';
    ep.saveAs(name);
};

$('#delete-folders').on('click',function(){
    parse();
});

function deleteEmptyFolders(data){
    left = data.length;
    for(var i =  0 ;i < data.length; i++){
        deleteFile(data[i]['ID'],data[i]['URL'],data[i]['Library'],data[i]['Subsite']);
    }
}

function parse(){
    $('#loading').show();
    var target = $('#delete-empty-folders')[0];
    var file = target.files[0];
      var filteredData = [];
       Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          complete: function(results) {
            data = results.data;
            for(var i = 0 ;i < data.length; i++){
              if(data[i]['Folder Name'] != ''){
                filteredData.push(data[i])
              }
            }
            deleteEmptyFolders(filteredData);
          }
       })     
    }

function deleteFile( itemID, fileRef, listName,webURL) {
    console.log(left);
    // This is the command needed to delete the specified file. It uses the ID and the URL of the file name. These values must be passed into this function when calling it.
    var batchCmd = "<Batch OnError='Continue'><Method ID='1' Cmd='Delete'><Field Name='ID'>" + itemID + "</Field><Field Name='FileRef'>" + fileRef + "</Field></Method></Batch>";
    // Use SPServices to delete the file.
    $().SPServices({
        operation: "UpdateListItems",
        async: false,
        listName: listName,
        updates: batchCmd,
        webURL : webURL,
        completefunc: function ( xData, Status ) {

            // Check the error codes for the web service call.
            $( xData.responseXML ).SPFilterNode( 'ErrorCode' ).each( function(){
                responseError = $( this ).text();

                // If the error codes indicate that the file was successfully deleted, inform the user.
                if ( responseError === '0x00000000' ) {
                    console.log(left);
                    //alert( "The file has been successfully deleted." );
                    left--;
                    if(left == 0){      
                        $('#loading').hide();
                        alert('DONE');
                    }
                }

                // If the error codes indicate that the file was NOT successfully deleted, inform the user.
                else {
                    //alert( "There was an error trying to delete the file." );
                
                }
            });
        }
    });
}
//GET WORKFLOWS FUNCTIONALITY
$('body').append('<script type="https://cdn.jsdelivr.net/sharepointplus/3.0.10/sharepointplus.js"></script>');
var allWorkflows = [];
var checkedSites = 0;
function getAllSiteWorkflows(site){
	$().SPServices({
    operation: "GetListItems",
    async: false,
    webURL: site,
    listName: "Workflows",
    completefunc: function (xData, Status) {
	checkedSites++

      $(xData.responseXML).SPFilterNode("z:row").each(function() {
        var ob = {};
        ob.WorkflowName = $(this).attr("ows_FileLeafRef");
        ob.WorkflowCreator = $(this).attr("ows_Editor");
        ob.WorkflowLocation = $(this).attr("ows_FileRef");
        allWorkflows.push(ob);
      });
      ;
      if(checkedSites == subSites.length){
      	generateWorkflowsExcel(allWorkflows);
      }
    }
  });
}
function generateWorkflowsExcel(workflows){
    var ep = new ExcelPlus();
    var cellsLetters = ['A','B','C','D','E','F','G','H','I'];
    var mainSite = subSites[0].url.split('/teams')[0];
    ep.createFile("All Workflows");
    ep.write({'cell':'A1','content': 'Workflow Name'});
    ep.write({'cell':'B1','content': 'Workflow Creator'});
    ep.write({'cell':'C1','content': 'Location'})
    var row = 2;
    for(var i = 0; i < workflows.length; i++){
        ep.write({'cell' : 'A' + row, 'content': $SP().cleanResult(workflows[i].WorkflowName)});
        ep.write({'cell' : 'B' + row, 'content': $SP().cleanResult(workflows[i].WorkflowCreator)});
        ep.write({'cell' : 'C' + row, 'content': mainSite+'/'+$SP().cleanResult(workflows[i].WorkflowLocation).split('/teams/')[0].split('/Workflows')[0]});
        row++
    }
    var name = _CTX.split('/');
    name = name[name.length - 1] + ' - All Workflows';
    ep.saveAs(name);
};
function cycleSites(sitesArray){
	for(var i=0; i<sitesArray.length; i++){
		getAllSiteWorkflows(sitesArray[i].url);
	}
}
$('#workflow-section').on('click',function(e){
    console.log(e.target)
    if (e.target.id == 'generate-workflows' || $(e.target).parent()[0].id == 'generate-workflows'){
         $('#generate-workflows').hide();
        $('#generating-workflows').show();
        if (!!window.Worker){
            worker = new Worker('js/getSubSitesWorker.js');
            worker.onmessage = function(e){
                subSites = e.data[0];
                cycleSites(subSites);
                $('#generating-workflows').hide();
                $('#ready-workflows').css({display:'block'})
            }
            worker.postMessage([_CTX,'structure', false]);  
        }
    }
     else if(e.target.id == 'cancel-workflows' || $(e.target).parent()[0].id == 'cancel-workflows'){
        $('#generating-workflows').hide();
        $('#generate-workflows').show();
        worker.terminate();
        worker = undefined;
    } else if(e.target.id == 'ready-workflows' || $(e.target).parent()[0].id == 'ready-workflows'){
        $('#ready-workflows').css({display:'none'});
        $('#generate-workflows').show();
    }
});


       
    

