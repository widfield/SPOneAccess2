var _CTX = $().SPServices.SPGetCurrentSite(),
    _SPGrind = new SPGrind(),
    tempGroups;

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
            } else {
                Materialize.toast("Sorry, can't paste user permissions.", 5000);
            }
        };
        pastePermissions.postMessage([currentUser, tempGroups]);
    }
    siteTemplate.update();
}

function allocateUserDetails(email) {
    var user = new User();
    user.setEmail(email);
    user.setInfoByEmail();
    user.setGroups();
    return user;
}

$('#user_form').submit(function(e) {
    e.preventDefault();
    thisUserEmail = $("#user_email").val();
    currentUser = allocateUserDetails(thisUserEmail);
    if (currentUser.getName() !== '') {
        $("#user_email").val(currentUser.getName());
        for (var i = 0; i < spData.length; i++) {
            if (spData[i].groups) {
                console.log("Updating view on user change!");
                compareUser(spData[i], currentUser, siteTemplate);
            }
        }
        showCurrentUserGroups();
    } else {
        $('#user_email').val('Invalid email').addClass('invalid');
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

function generateExelFile(sites, groups){
    console.log('generating excel file');
    
    ep.createFile('Permission Matrix');
    ep.createSheet('Users');
    var cellNumber = '';            
    for (var i = 0; i < sites.length; i++){
        cellNumber = convertNumber(i + 1);
        cellNumber += 1;
        ep.write({
            'sheet' : 'Permission Matrix',
            'cell' :  cellNumber,
            'content' : sites[i].name
        });
    }

    for (var i = 0; i < groups.length; i++){
        ep.write({
            'sheet' : 'Permission Matrix',
            'cell' : 'A' + (i + 2),
            'content' : groups[i].name
        });
        for (var j = 0; j < sites.length; j++){
            for(var k = 0; k < groups[i].url.length; k++){
                if (sites[j].url == groups[i].url[k]){
                    cellNumber = '';
                    cellNumber = convertNumber(j + 1);
                    cellNumber += (i + 2);
                    for (var p = 0; p < groups[i].permissions[k].length; p++){
                        ep.write({
                            'sheet' : 'Permission Matrix',
                            'cell' : cellNumber,
                            'content' : groups[i].permissions[k][p]
                        })
                    }
                }
            }
        }

        cellNumber = convertNumber(i); 
        ep.write({
            'sheet' : 'Users',
            'cell' : cellNumber + 1,
            'content' : groups[i].name
        })
        for(var u = 0; u < groups[i].users.length; u++){
            var userInfo = groups[i].users[u].email || groups[i].users[u].login;
            ep.write({
                'sheet' : 'Users',
                'cell' : cellNumber + (u + 2),
                'content' : userInfo
            })
        } 
    }

    var name = SITEENV.split('/');
    name = name[name.length - 1] + ' - Permission Matrix';
    ep.saveAs(name);

};

 $('#central-nav').on('click', function(e){
    if (e.target.id == 'show-matrix'){
        $('#access-section').hide();
       // $('#action-btn-contaier').hide();
        $('#massDelete-section').hide();
        $('#matrix-section').show();
    } else if(e.target.id == 'show-access'){
        $('#matrix-section').hide();
        $('#massDelete-section').hide();
        $('#access-section').show();
       // $('#action-btn-contaier').show();
    } else if (e.target.id == 'show-massDelete'){
        $('#access-section').hide();
        $('#matrix-section').hide();
        $('#massDelete-section').show();
    }
});

var sites = [];
var matrixSites = [];
var groups = []; 
var usersInGroup = [];
var ep = new ExcelPlus();
var worker;
var SITEENV;
SITEENV = $().SPServices.SPGetCurrentSite();
  

$('#matrix-section').on('click', function(e){
    if (e.target.id == 'generate-matrix'){
        $('#generate-matrix').hide()
        $('#generating-matrix').show();
        if (!!window.Worker){
            worker = new Worker('js/generateMatrixWorker.js');
            worker.onmessage = function(e){
                matrixSites = e.data[0];
                groups = e.data[1];
                generateExelFile(matrixSites, groups);
                $('#generating-matrix').hide();
                $('#ready-matrix').show();
            }
            worker.postMessage([SITEENV, 'matrix']);
        }
    } else if(e.target.id == 'cancel-matrix'){
        $('#generating-matrix').hide();
        $('#generate-matrix').show();
        worker.terminate();
        worker = undefined;
    } else if(e.target.id == 'ready-matrix'){
        $('#ready-matrix').hide();
        $('#generate-matrix').show();
    }
});



//mass delete section

var epDel = new ExcelPlus();
var userEmails = [];
var validUsers = [];
var invalidUsers = [];
var validUsersCounter = 0;
var invalidUsersCounter = 0;

//for the copy clipboard
// $(document).ready(function() {
//     var clip = new ZeroClipboard($("#d_clip_button"));
// });

    function resetAll() {
        epDel.reset();
        validUsers = [];
        userEmails = [];
    };

    // we call openLocal() and when the file is loaded then we want to display its content
    // openLocal() will use the FileAPI if exists, otherwise it will use a Flash object
     epDel.openLocal({
        "flashPath": "2.2/swfobject/",
        "labelButton": "Open an Excel file"
    }, function() {
        var arr = epDel.selectSheet('MassDelete').readAll();
        console.log(arr);
        // iterate and push emails to userEmails array
        for (var i = 0; i < arr.length; i++) {
            for (var j = 0; j < arr[i].length; j++) {
                userEmails.push(arr[i][j]);
                //console.log(arr[i][j]);
            }
        }
        
        iterateUsers();
    });

    function iterateUsers() {
        for (var x = 0; x < userEmails.length; x++) {
            var user = new User();
            user.setEmail(userEmails[x]);
            user.setInfoByEmail();
            if (!!user.getLogin()){
                validUsers.push(user); 
                $("#valid-list").append(
                    "<li class='row'><span class='col s6'>"+ user.getEmail() + "</span><span class='col s6 del-valid' id='" + validUsersCounter +"' style='cursor:pointer;position:relative;top:1px'>remove</span></li>");
                validUsersCounter++;
            } else {
                invalidUsers.push(userEmails[x]);
                $("#invalid-list").append(
                    "<li class='row'><span class='col s6'>"+ userEmails[x] +"</span></li>"); //<span class='col s6 del-invalid' id='" + invalidUsersCounter +"'  style='cursor:pointer;position:relative;top:1px'>delete</span></li>");
                invalidUsersCounter++;
            }
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
                    userLoginName: validUsers[user].getLogin(),
                    async:true,
                    completefunc: function(xData, Status){
                        if (Status == 'success'){
                            console.log('validUsers['+ user +'] was deleted');
                                validUsersCounter--;
                                updateValidUsersNumber();
                                $('#'+ user).closest('li').remove();                       
                        } else {
                            $('#'+ user).prev().css('background','red');
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
    });

   

