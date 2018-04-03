/*
 * The name of menu item that contains the encode action.
 */
var menuItemName = "Embed all referenced images as Base64-encoded";

// Status messages.
var succesfulStatus = "Images embedded successfully";
var inProgressStatus = "Embedding images...";
var failStatus = "Failed to embed images";

// Current status message.
var processStatus = succesfulStatus; 

// Method for show a status message with a operation status icon
var showStatusWithIcon = null;
// Enum for identify the operation status icon
var operationStatusEnum =  null;

/*
 * Return the attribute name that contains image referances for the given element.
 *
 */
var getImageAttr = function (authorElement) {
    var name = authorElement.getName();
    // Dita
    if ("image".equals(name)) {
        return "href";
        //HTML
    } else if ("img".equals(name)) {
        return "src";
        // DocBook
    } else if ("imagedata".equals(name)) {
        return "fileref";
    } else if ("graphic".equals(name) || "inlinegraphic".equals(name)) {
        return "fileref"
    } else {
        return null;
    }
}

var resultManager = Packages.ro.sync.exml.workspace.api.PluginWorkspaceProvider.getPluginWorkspace().getResultsManager();

/*
 * Application started.
 */
function applicationStarted(pluginWorkspaceAccess) {
	try{
		// Get the OperationStatus Enum. This is available from Oxygen 20.
		operationStatusEnum = Packages.java.lang.Class.forName("ro.sync.exml.workspace.api.OperationStatus");
		
		var classes = Packages.java.lang.reflect.Array.newInstance(Packages.java.lang.Class, 2);
		classes[0] = Packages.java.lang.Class.forName("java.lang.String");
		classes[1] = operationStatusEnum;
		
		// Get the method for show a status message with a operation status icon. 
		// This method in available from Oxygen 20.
		var showStatusWithIcon = pluginWorkspaceAccess.getClass().getDeclaredMethod("showStatusMessage", classes);
	} catch (e) {
		// This exception will be catch if the method or class don't exit.
		// Do nothing.
	}
	
    menuContributor = {
        customizeAuthorPopUpMenu: function (popUp, authorAccess) {
            try {
                /*Create absolute reference*/
                mi = new Packages.javax.swing.JMenuItem(menuItemName);
                popUp.add(mi);
                actionPerfObj = {
                    actionPerformed: function (e) {
                    	// Reset the status and icon
                    	processStatus = succesfulStatus; 
                    	if(operationStatusEnum != null){
                    		icon =  Packages.ro.sync.exml.workspace.api.OperationStatus.SUCCESSFUL;
                    	}
                    	
                        documentController = authorAccess.getDocumentController();
                        var authorDocumentNode = documentController.getAuthorDocumentNode();
                        editorLocation = authorAccess.getEditorAccess().getEditorLocation();
                        
                        var thread = java.lang.Thread(function () {
                            if (authorDocumentNode != null) {
                            	rootNode = authorDocumentNode.getRootElement();
                                try {
                                    javax.swing.SwingUtilities.invokeAndWait(function () {
                                    	// Show a status message.
                                    	if(showStatusWithIcon != null && icon!= null){
                                    		showStatusWithIcon.invoke(pluginWorkspaceAccess, inProgressStatus, icon);
                                    	}else{
                                    		pluginWorkspaceAccess.showStatusMessage(inProgressStatus);
                                    	}
                                       documentController.beginCompoundEdit();
                                    });
                                    // Iterate over nodes and embed image as base64
                                    iterateNodesAndEncodeImages(rootNode);
                                    
                                    javax.swing.SwingUtilities.invokeAndWait(function () {
                                        documentController.endCompoundEdit();
                                    	// Show a final status message.
                                        if(showStatusWithIcon != null && icon!= null){
                                    		showStatusWithIcon.invoke(pluginWorkspaceAccess, processStatus, icon);
                                    	}else{
                                    		pluginWorkspaceAccess.showStatusMessage(processStatus);
                                    	}
                                    });
                                }
                                catch (ex) {
                                    Packages.java.lang.System.err.println(ex);
                                }
                            }
                        });
                        thread.start()
                    }
                }
                mi.addActionListener(new JavaAdapter(Packages.java.awt.event.ActionListener, actionPerfObj));
            }
            catch (e1) {
                Packages.java.lang.System.err.println(e1);
            }
        }
    }
    
    pluginWorkspaceAccess.addMenusAndToolbarsContributorCustomizer(new Packages.ro.sync.exml.workspace.api.standalone.actions.MenusAndToolbarsContributorCustomizer(menuContributor));
}

/*
 * Application closing.
 */
function applicationClosing(pluginWorkspaceAccess) {
}

/*
 * Iterate over author elements starting with the given author element
 * and encodes the images.
 */
var iterateNodesAndEncodeImages = function interateAndEncode(authorElement) {
    encodeImageBase64(authorElement)
    var childNodes = authorElement.getContentNodes();
    var i;
    for (i = 0; i < childNodes.size();
    i++) {
        var currentNode = childNodes. get (i);
        if (currentNode.getType() == Packages.ro.sync.ecss.extensions.api.node.AuthorNode.NODE_TYPE_ELEMENT) {
            interateAndEncode(new JavaAdapter(Packages.ro.sync.ecss.extensions.api.node.AuthorElement, currentNode));
        }
    }
};

/*
 * Encodes image base 64 if the given author element constais one.
 */
var encodeImageBase64 = function (authorElement) {
    var xmlBaseURL = authorElement.getXMLBaseURL();
    var imageAttrName = getImageAttr(authorElement);
    
    if (imageAttrName != null) {
        var href = authorElement.getAttribute(imageAttrName);
        if (href != null && ! href.getValue().isEmpty()) {
            var absoluteHref = Packages.ro.sync.util.URLUtil.makeAbsolute(xmlBaseURL.toString(), href.getValue());
            var base64Content = createImageBase64Encoding(absoluteHref);
            if (! base64Content.isEmpty()) {
                var attrVal = new Packages.ro.sync.ecss.extensions.api.node.AttrValue(base64Content);
                
                try {
                    javax.swing.SwingUtilities.invokeAndWait(function () {
                        documentController.setAttribute(imageAttrName, attrVal, authorElement);
                    });
                }
                catch (ex) {
                    Packages.java.lang.System.err.println(ex);
                }
            }
        }
    }
}

/*
 * Get the encoded content for the image at the given path
 */
var createImageBase64Encoding = function (imagePath) {
    var stringBuilder = new Packages.java.lang.StringBuilder();
    var content = null;
    var contentType;
    var inputStream = null;
    try {
        var url = new Packages.java.net.URL(imagePath);
        var urlCon = url.openConnection();
        
        // Get content type.
        contentType = urlCon.getContentType();
        if (contentType == null) {
            contentType = "image";
            var lastIndexOf = imagePath.lastIndexOf('.');
            
            if (lastIndexOf > 0) {
                var extension = imagePath.substring(lastIndexOf);
                contentType = contentType + "/" + extension.toLowerCase();
            }
        }
        
        // Get content.
        inputStream = urlCon.getInputStream();
        content = Packages.org.apache.commons.io.IOUtils.toByteArray(inputStream);
        // Encode content to Base64
        var base64Content = Packages.org.apache.commons.codec.binary.Base64.encodeBase64String(content);
        
        if (base64Content != null && ! base64Content.isEmpty()) {
            // Append data type.
            stringBuilder.append("data:").append(contentType).append(";base64, ");
            stringBuilder.append(base64Content);
        }
    }
    catch (ex) {
    	processStatus = failStatus;
    	if(operationStatusEnum != null){
    		icon = Packages.ro.sync.exml.workspace.api.OperationStatus.FAILED;
    	}
    	if (resultManager != null) {
            try {
                javax.swing.SwingUtilities.invokeAndWait(function () {
                    var result = new Packages.ro.sync.document.DocumentPositionedInfo(
                    Packages.ro.sync.document.DocumentPositionedInfo.SEVERITY_WARN,
                    (new Packages.java.lang.Exception(ex)).getMessage(),
                    editorLocation.toString());
                    
                    resultManager.addResult(menuItemName, result, Packages.ro.sync.exml.workspace.api.results.ResultsManager.ResultType.PROBLEM, false, false);
                });
            }
            catch (ex) {
                Packages.java.lang.System.err.println(ex);
            }
        }
    }
    finally {
        if (inputStream != null) {
            //Close InputStream.
            try {
                inputStream.close();
            }
            catch (ex) {
                //Do nothing.
            }
        }
    }
    return stringBuilder.toString();
}