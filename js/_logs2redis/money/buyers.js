

exports.registerFilters = function(register, sg, callback) {

  var _         = sg._;

  register({
    purchOk:    {set:true},
    allocCart:  {enum:true}
  }, 
  
  // Categorize the stats (all the numeric fields)
  function(emitter, params) {
    var purchOk   = params.emitters.purchOk  || emitter,
      allocCart   = params.emitters.allocCart  || emitter;

    return function(item, slug) {
      var upk, tid, product_id, value;
      var action = item[3];

      // 2013/12/16/08:04:39~pr1-twosmiles-com~get_card_info_multi_B_ok~6r3FsRAU967590xz~2095492148~115601~OK~~sarahjhedrick@hotmail.com~3608525242~0~0~XXXXXXXXXXXX8053~11111111~active~20.00~25.00~~7060997~OK
      //    2               ~       2         ~        3               ~        4       ~     5    ~   6  ~7 ~8~       9                ~    10    ~11~12~    13        ~   14   ~    15~ 16  ~ 17  ~18~ 19  ~20

      if (action === 'get_card_info_multi_b_ok' && item[20] === 'ok') {

        var email = item[9], isActive = item[15], paid = item[16], promoCode = item[18]; upk = item[4]; tid = item[5]; product_id = item[6]; value = item[17]; 

        // fix up the value field
        if (value.length > 0 && value.length - value.indexOf('.') < 3) { value += '0'; }

        if (upk.length > 0) {
          if (email.length > 0)       { purchOk.SADD(["email:%s1:upks", email], upk); }
          if (promoCode.length > 0)   { purchOk.SADD(["promo_code:%s1:upks", promoCode], upk); }
          if (paid.length > 0)        { purchOk.SADD(["paid:%s1:upks", paid], upk); }
          if (value.length > 0)       { purchOk.SADD(["value:%s1:upks", value], upk); }

          if (paid.length > 0)        { purchOk.SADD(["paid:%s1:product_ids", paid], product_id); }
          if (value.length > 0)       { purchOk.SADD(["value:%s1:product_ids", value], product_id); }

          if (product_id.length > 0)  { purchOk.SET(["product_id:%s1:upk", product_id], upk);
                                        purchOk.SET(["upk:%s1:product_id", upk], product_id); }

          if (tid.length > 0)         { purchOk.SET(["tid:%s1:upk", tid], upk);
                                        purchOk.SET(["upk:%s1:tid", upk], tid); 
                                        purchOk.SET(["tid:%s1:product_id", tid], product_id); 
                                        purchOk.SET(["product_id:%s1:tid", product_id], tid); }


          if (paid !== value)         { purchOk.SADD("discounted:1:upks", upk); }
          else                        { purchOk.SADD("discounted:0:upks", upk); }
        }
      } else if (action === 'allocate_cart_ok') {

        // 2013/12/22/07:55:21~pw1-twosmiles-com~allocate_cart_ok~EylmiUsi101843Rc~125185~marriott~50.00~50.0~~false~75.94.169.201
        // 1                  ~ 2               ~ 3              ~ 4              ~ 5    ~ 6      ~ 7   ~ 8  ~9~10  ~ 11

        var brand = item[6], ip = item[11]; upk = item[4]; product_id = item[5]; value = item[8];

        // fix up the value field
        if (value.length > 0 && value.length - value.indexOf('.') < 3) { value += '0'; }

        if (upk.length > 0) {

          if (ip.length > 0)          { allocCart.SADD(["ip:%s1:upks", ip], upk);
                                        allocCart.SET(["upk:%s1:ip", upk], ip); }

          if (product_id.length > 0)  { allocCart.SET(["product_id:%s1:upk", product_id], upk);
                                        allocCart.SET(["upk:%s1:product_id", upk], product_id); 
                                        allocCart.SADD(["ip:%s1:order_ids", ip], product_id);
                                        allocCart.SET(["product_id:%s1:ip", product_id], ip); }

        }
      } else if (action === 'finalize') {

        // 2013/12/22/07:55:21~pw1-twosmiles-com~finalize~b5abffe3-12d7-404d-ad2e-e1628ae56769~115633~490~54~5x7~gift_card_info_pending
        // 1                  ~ 2               ~ 3      ~ 4                                  ~ 5    ~ 6 ~ 7~ 8 ~ 9

        var guid = item[4], mediaSize = item[8]; product_id = item[5];
        if (guid.length > 0)          { purchOk.SET(["guid:%s1:product_id", guid], product_id);
                                        purchOk.SET(["product_id:%s1:guid", product_id], guid); }
      }
    };
  });

  return callback();
};

