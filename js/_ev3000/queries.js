
awk(function() {

  filter(function(x) {
      return  x[6].query.art_id &&
              x[6].pathname.split("/")[1] === "generateTextLayer" &&
              x[10].pathname.split("/")[1] === "cart";
    }, 
    function(x) {
      //$a[0]=x[6].query;
      histo(x[6].query.art_id);
    }
  );
});


//var fn = function() {
//
//  filter(function(x) {
//      return  x[6].query.art_id &&
//              x[6].pathname.split("/")[1] === "generateTextLayer" &&
//              x[10].pathname.split("/")[1] === "cart";
//    }, 
//    function(x) {
//      //$a[0]=x[6].query;
//      histo(x[6].query.art_id);
//    }
//  );
//};
//
//var script = fn.toString();
//awk(script);

